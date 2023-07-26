#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts = __importStar(require("typescript"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function getImplementedInterfaces(type, checker) {
    const interfaces = new Set();
    if (type.isClassOrInterface()) {
        const baseTypes = checker.getBaseTypes(type);
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
function getJsDoc(node) {
    const jsDocTags = ts.getJSDocTags(node);
    if (jsDocTags.length === 0) {
        return undefined;
    }
    return jsDocTags.map(tag => tag.getText()).join('\n');
}
function visit(node, checker) {
    if (!ts.isClassDeclaration(node)) {
        if (ts.isFunctionDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }
            const signature = checker.getSignatureFromDeclaration(node);
            const returnType = checker.typeToString(signature.getReturnType());
            const params = signature.parameters.map(p => checker.typeToString(checker.getTypeAtLocation(p.valueDeclaration))).join(', ');
            const functionInfo = {
                name: symbol.getName(),
                returnType,
                params,
                jsDoc: getJsDoc(node)
            };
            return functionInfo;
        }
        if (ts.isVariableDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }
            const type = checker.getTypeAtLocation(node);
            const variableInfo = {
                name: symbol.getName(),
                type: checker.typeToString(type),
                jsDoc: getJsDoc(node)
            };
            return variableInfo;
        }
        return;
    }
    const symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) {
        return;
    }
    const details = checker.getTypeAtLocation(node);
    const classInfo = {
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
        const memberSymbol = checker.getSymbolAtLocation(member.name);
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
            const propertyInfo = {
                name: memberSymbol.getName(),
                type: checker.typeToString(type),
                visibility,
                jsDoc: getJsDoc(member)
            };
            if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) {
                classInfo.statics.properties[visibility].push(propertyInfo);
            }
            else {
                classInfo.properties[visibility].push(propertyInfo);
            }
        }
        else if (ts.isMethodDeclaration(member)) {
            const signature = checker.getSignatureFromDeclaration(member);
            const returnType = checker.typeToString(signature.getReturnType());
            const params = signature.getParameters().map(paramSymbol => {
                const paramDeclaration = paramSymbol.valueDeclaration;
                return {
                    name: paramSymbol.getName(),
                    type: checker.typeToString(checker.getTypeAtLocation(paramDeclaration))
                };
            });
            const methodInfo = {
                name: memberSymbol.getName(),
                returnType,
                params,
                visibility,
                jsDoc: getJsDoc(member)
            };
            if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) {
                classInfo.statics.methods[visibility].push(methodInfo);
            }
            else {
                classInfo.methods[visibility].push(methodInfo);
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
const options = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS
};
// Créez le programme.
const program = ts.createProgram(fileNames, options);
// Maintenant, vous pouvez utiliser le programme pour obtenir le TypeChecker.
const checker = program.getTypeChecker();
// Créez un objet pour stocker les informations de classe
const classInfos = {};
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
                        }
                        else {
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
function cleanEmptyArrays(obj) {
    for (const key in obj) {
        if ((Array.isArray(obj[key]) && obj[key].length === 0) || (key === 'implements' && Array.isArray(obj[key]) && obj[key].length === 0)) {
            delete obj[key];
        }
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleanEmptyArrays(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    }
}
cleanEmptyArrays(classInfos);
const json = JSON.stringify(classInfos, null, 2);
fs.writeFileSync("documentation.json", json);
