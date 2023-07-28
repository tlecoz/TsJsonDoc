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

type PropertyInfo = {
    name: string,
    type: string,
    visibility: "public" | "private" | "protected",
    value?: string,
    get?: boolean,
    set?: boolean,
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
        public?: PropertyInfo[],
        private?: PropertyInfo[],
        protected?: PropertyInfo[]
    },
    methods?: {
        public?: MethodInfo[],
        private?: MethodInfo[],
        protected?: MethodInfo[]
    },
    statics?: {
        properties?: {
            public?: PropertyInfo[],
            private?: PropertyInfo[],
            protected?: PropertyInfo[]
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
    if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node)) {

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
            const propertyInfo: PropertyInfo = {
                name: memberSymbol.getName(),
                type: checker.typeToString(type),
                visibility,
                jsDoc: getJsDoc(member)
            };

            if (ts.isGetAccessor(member)) propertyInfo.get = true;
            if (ts.isSetAccessor(member)) propertyInfo.set = true;


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

const rootDir = "../xgpu/src/xGPU"  //process.argv[2] || "./src/";
const fileNames = ts.sys.readDirectory(rootDir, ["ts"]);
const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS
};



const program = ts.createProgram(fileNames, options);
const checker = program.getTypeChecker();
const classInfos: any = {};

for (const fileName of fileNames) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {

        ts.forEachChild(sourceFile, (node) => {
            if (node) {
                const classInfo = visit(node, checker);
                if (classInfo) {
                    let relativePath = path.relative(rootDir, fileName);
                    relativePath = relativePath.substring(0, relativePath.length - 3);

                    const segments = relativePath.split(path.sep);
                    let currentObject = classInfos;
                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i];
                        if (i === segments.length - 1) {
                            currentObject[segment] = classInfo;
                        } else {
                            if (!currentObject[segment]) {
                                currentObject[segment] = {};
                            }
                            currentObject = currentObject[segment];
                        }
                    }
                }
            }
        });


        // Check if jsdoc.json exists in the directory
        let relativePath = path.relative(rootDir, fileName);
        relativePath = relativePath.substring(0, relativePath.length - 3);

        const segments = relativePath.split(path.sep);
        let currentObject = classInfos;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!currentObject[segment]) {
                currentObject[segment] = {};
            }
            currentObject = currentObject[segment];
        }

        const jsdocPath = path.join(rootDir, ...segments, 'jsdoc.json');
        if (fs.existsSync(jsdocPath)) {
            // Read the content of jsdoc.json and parse it as JSON
            const jsdocContent = JSON.parse(fs.readFileSync(jsdocPath, 'utf8'));
            // Add the JSON content to the directory object
            currentObject['jsdoc'] = jsdocContent;
        }
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
