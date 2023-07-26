#!/usr/bin/env node
import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

type FunctionInfo = {
    name: string,
    returnType: string,
    params: string,
    jsDoc?: string
}

type VariableInfo = {
    name: string,
    type: string,
    jsDoc?: string
}

type PropetyInfo = {
    name: string,
    type: string,
    visibility: "public" | "private" | "protected",
    value?: string,
    jsDoc?: string
}

type MethodInfo = {
    name: string,
    returnType: string,
    visibility: "public" | "private" | "protected",
    params?: { name: string, type: string }[],
    jsDoc?: string
}

type ClassInfo = {
    name: string,
    extends?: string[],
    implements?: string[],
    properties?: {
        public?: PropetyInfo[],
        private?: PropetyInfo[],
        protected?: PropetyInfo[]
    },
    methods?: {
        public?: MethodInfo[],
        private?: MethodInfo[],
        protected?: MethodInfo[]
    },
    statics?: {
        properties?: {
            public?: PropetyInfo[],
            private?: PropetyInfo[],
            protected?: PropetyInfo[]
        },
        methods?: {
            public?: MethodInfo[],
            private?: MethodInfo[],
            protected?: MethodInfo[]
        }
    },
    jsDoc?: string,
    functions?: FunctionInfo[],
    variables?: VariableInfo[],
}

function getImplementedInterfaces(type: ts.Type, checker: ts.TypeChecker): string[] {
    const interfaces: Set<string> = new Set();

    if (type.isClassOrInterface()) {
        const baseTypes = checker.getBaseTypes(type as ts.InterfaceType);
        for (const baseType of baseTypes) {
            const symbol = baseType.getSymbol();
            if (symbol && (symbol.flags & ts.SymbolFlags.Interface) !== 0) {
                interfaces.add(symbol.name);
                getImplementedInterfaces(baseType, checker).forEach(i => interfaces.add(i));
            }
        }
    }

    return Array.from(interfaces);
}

function getJsDoc(node: ts.Node): string | undefined {
    const jsDocTags = ts.getJSDocTags(node);
    if (jsDocTags.length === 0) {
        return undefined;
    }

    return jsDocTags.map(tag => tag.getText()).join('\n');
}

function visit(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isClassDeclaration(node)) {

        if (ts.isFunctionDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name!);
            if (!symbol) {
                return;
            }

            const signature = checker.getSignatureFromDeclaration(node);
            const returnType = checker.typeToString(signature!.getReturnType());
            const params = signature!.parameters.map(p => checker.typeToString(checker.getTypeAtLocation(p.valueDeclaration!))).join(', ');

            const functionInfo: FunctionInfo = {
                name: symbol.getName(),
                returnType,
                params,
                jsDoc: getJsDoc(node)
            };

            return functionInfo;
        }

        if (ts.isVariableDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name!);
            if (!symbol) {
                return;
            }

            const type = checker.getTypeAtLocation(node);
            const variableInfo: VariableInfo = {
                name: symbol.getName(),
                type: checker.typeToString(type),
                jsDoc: getJsDoc(node)
            };

            return variableInfo;
        }

        return;
    }

    const symbol = checker.getSymbolAtLocation(node.name!);
    if (!symbol) {
        return;
    }

    const details = checker.getTypeAtLocation(node);

    const classInfo: ClassInfo = {
        name: symbol.getName(),
        extends: [],
        implements: getImplementedInterfaces(details, checker),
        properties: {
            public: [],
            private: [],
            protected: []
        },
        methods: {
            public: [],
            private: [],
            protected: []
        },
        statics: {
            properties: {
                public: [],
                private: [],
                protected: []
            },
            methods: {
                public: [],
                private: [],
                protected: []
            }
        },
        jsDoc: getJsDoc(node)
    };

    let baseType = details.getBaseTypes()[0];
    while (baseType) {
        const baseSymbol = baseType.getSymbol();
        if (baseSymbol) {
            classInfo.extends.push(baseSymbol.getName());
        }
        baseType = baseType.getBaseTypes() && baseType.getBaseTypes().length > 0 ? baseType.getBaseTypes()[0] : undefined;
    }

    for (const member of node.members) {
        const memberSymbol = checker.getSymbolAtLocation(member.name!);
        if (!memberSymbol) {
            continue;
        }

        const visibility = ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Public
            ? 'public'
            : ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Private
                ? 'private'
                : 'protected';

        if (ts.isPropertyDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
            const type = checker.getTypeAtLocation(member);
            const propertyInfo: PropetyInfo = {
                name: memberSymbol.getName(),
                type: checker.typeToString(type),
                visibility,
                jsDoc: getJsDoc(member)
            };

            if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) {
                classInfo.statics!.properties![visibility].push(propertyInfo);
            } else {
                classInfo.properties![visibility].push(propertyInfo);
            }
        } else if (ts.isMethodDeclaration(member)) {
            const signature = checker.getSignatureFromDeclaration(member);
            const returnType = checker.typeToString(signature!.getReturnType());

            const params = signature!.getParameters().map(paramSymbol => {
                const paramDeclaration = paramSymbol.valueDeclaration as ts.ParameterDeclaration;
                return {
                    name: paramSymbol.getName(),
                    type: checker.typeToString(checker.getTypeAtLocation(paramDeclaration))
                };
            });

            const methodInfo: MethodInfo = {
                name: memberSymbol.getName(),
                returnType,
                params,
                visibility,
                jsDoc: getJsDoc(member)
            };

            if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) {
                classInfo.statics!.methods![visibility].push(methodInfo);
            } else {
                classInfo.methods![visibility].push(methodInfo);
            }
        }
    }

    return classInfo;
}

// Définissez le répertoire racine
const rootDir = process.argv[2] || "./src/";

// Lisez tous les fichiers TypeScript dans le répertoire et ses sous-répertoires
const fileNames = ts.sys.readDirectory(rootDir, ["ts"]);

// Créez des options de compilation. Vous pouvez spécifier toutes les options que vous utiliseriez normalement dans un fichier tsconfig.json.
const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS
};

// Créez le programme.
const program = ts.createProgram(fileNames, options);

// Maintenant, vous pouvez utiliser le programme pour obtenir le TypeChecker.
const checker = program.getTypeChecker();

// Créez un objet pour stocker les informations de classe
const classInfos: any = {};

// Parcourez tous les fichiers source
for (const fileName of fileNames) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {
        // Parcourez tous les nœuds du fichier source
        ts.forEachChild(sourceFile, (node) => {
            if (node) {
                const classInfo = visit(node, checker);
                if (classInfo) {
                    // Obtenez le chemin relatif du fichier par rapport au répertoire racine
                    let relativePath = path.relative(rootDir, fileName);
                    // Retirez l'extension .ts
                    relativePath = relativePath.substring(0, relativePath.length - 3);
                    // Divisez le chemin en segments
                    const segments = relativePath.split(path.sep);
                    // Accédez à l'emplacement correct dans l'objet classInfos et stockez les informations de classe
                    let currentObject = classInfos;
                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i];
                        if (i === segments.length - 1) {
                            // Si nous sommes au dernier segment, nous stockons les informations de classe
                            currentObject[segment] = classInfo;
                        } else {
                            // Sinon, nous accédons à l'objet correspondant au segment actuel, ou nous en créons un nouveau si nécessaire
                            if (!currentObject[segment]) {
                                currentObject[segment] = {};
                            }
                            currentObject = currentObject[segment];
                        }
                    }
                }
            }
        });
    }
}

console.log(classInfos);

function cleanEmptyArrays(obj: any) {
    for (const key in obj) {
        if ((Array.isArray(obj[key]) && obj[key].length === 0) || (key === 'implements' && Array.isArray(obj[key]) && obj[key].length === 0)) {
            delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleanEmptyArrays(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    }
}
cleanEmptyArrays(classInfos)

const json = JSON.stringify(classInfos, null, 2);
fs.writeFileSync("documentation.json", json);
