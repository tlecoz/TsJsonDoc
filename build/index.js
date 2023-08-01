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
const rootDir = process.argv[2] || "../xgpu/src/xGPU";
const outputDir = process.argv[3] || "./";
const outputFileName = process.argv[4] || "documentation.json";
const useRawText = process.argv[5] !== 'false';
function getImplementedInterfaces(node, checker) {
    const interfaces = new Set();
    if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                for (const type of clause.types) {
                    const symbol = checker.getSymbolAtLocation(type.expression);
                    if (symbol) {
                        //console.log(symbol.name)
                        interfaces.add(symbol.name);
                    }
                }
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
    const jsDoc = {};
    for (const tag of jsDocTags) {
        const tagName = tag.tagName.text;
        let tagText = '';
        if (typeof tag.comment === 'string') {
            tagText = tag.comment;
        }
        switch (tagName) {
            case 'param':
                if (!jsDoc.params) {
                    jsDoc.params = {};
                }
                if (tag) {
                    const paramName = tag.name.getText();
                    jsDoc.params[paramName] = tagText;
                }
                break;
            case 'returns':
                jsDoc.returns = tagText;
                break;
            case 'example':
                if (!jsDoc.examples) {
                    jsDoc.examples = [];
                }
                jsDoc.examples.push(tagText);
                break;
            default:
                // Traitez toutes les autres balises comme faisant partie de la description
                if (!jsDoc.description) {
                    jsDoc.description = '';
                }
                jsDoc.description += `@${tagName} ${tagText}\n`;
                break;
        }
    }
    return jsDoc;
}
function visit(node, checker) {
    if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node)) {
        if (ts.isEnumDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }
            const enumInfo = {
                objectType: "enum",
                name: symbol.getName(),
                members: [],
                jsDoc: getJsDoc(node),
                rawText: useRawText ? node.getText() : undefined,
            };
            for (const member of node.members) {
                const memberSymbol = checker.getSymbolAtLocation(member.name);
                if (!memberSymbol) {
                    continue;
                }
                let memberValue;
                if (member.initializer) {
                    if (ts.isNumericLiteral(member.initializer)) {
                        memberValue = Number(member.initializer.text);
                    }
                    else if (ts.isStringLiteral(member.initializer)) {
                        memberValue = member.initializer.text;
                    }
                    else {
                        // Pour les autres types d'expressions, vous pouvez utiliser le type checker pour obtenir leur valeur
                        const type = checker.getTypeAtLocation(member.initializer);
                        const symbol = type.getSymbol();
                        if (symbol) {
                            memberValue = symbol.getName();
                        }
                    }
                }
                const enumMemberInfo = {
                    name: memberSymbol.getName(),
                    value: memberValue,
                    jsDoc: getJsDoc(member),
                    rawText: useRawText ? member.getText() : undefined,
                };
                enumInfo.members.push(enumMemberInfo);
            }
            return enumInfo;
        }
        if (ts.isTypeAliasDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }
            const type = checker.getTypeAtLocation(node);
            const typeAliasInfo = {
                objectType: "type",
                name: symbol.getName(),
                type: checker.typeToString(type),
                jsDoc: getJsDoc(node),
                rawText: useRawText ? node.getText() : undefined,
            };
            return typeAliasInfo;
        }
        if (ts.isFunctionDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }
            const signature = checker.getSignatureFromDeclaration(node);
            const returnType = checker.typeToString(signature.getReturnType());
            const params = signature.parameters.map(p => checker.typeToString(checker.getTypeAtLocation(p.valueDeclaration))).join(', ');
            const functionInfo = {
                objectType: "function",
                name: symbol.getName(),
                returnType,
                params,
                jsDoc: getJsDoc(node),
                rawText: useRawText ? node.getText() : undefined,
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
                objectType: "variable",
                name: symbol.getName(),
                type: checker.typeToString(type),
                jsDoc: getJsDoc(node),
                rawText: useRawText ? node.getText() : undefined,
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
    const properties = {};
    const classInfo = {
        objectType: "class",
        name: symbol.getName(),
        filePath: "",
        extends: [],
        implements: getImplementedInterfaces(node, checker),
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
        constructor: undefined,
        jsDoc: getJsDoc(node),
        rawText: useRawText ? node.getText() : undefined,
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
        if (ts.isConstructorDeclaration(member)) {
            const signature = checker.getSignatureFromDeclaration(member);
            const params = signature.parameters.map(paramSymbol => {
                const paramDeclaration = paramSymbol.valueDeclaration;
                return {
                    name: paramSymbol.getName(),
                    type: checker.typeToString(checker.getTypeAtLocation(paramDeclaration))
                };
            });
            const constructorInfo = {
                objectType: "constructor",
                name: "constructor",
                params,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? member.getText() : undefined,
            };
            classInfo.constructor = constructorInfo;
        }
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
            const prop = properties[memberSymbol.getName()];
            let mustPush = true;
            const propertyInfo = prop ? prop : {
                objectType: "property",
                name: memberSymbol.getName(),
                type: checker.typeToString(type),
                visibility,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? member.getText() : undefined,
            };
            if (!prop)
                properties[memberSymbol.getName()] = propertyInfo;
            else
                mustPush = false;
            if (ts.isGetAccessor(member))
                propertyInfo.get = true;
            if (ts.isSetAccessor(member))
                propertyInfo.set = true;
            if (symbol.getName() === "Vec2")
                console.log("prop = ", prop);
            if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) {
                if (mustPush)
                    classInfo.statics.properties[visibility].push(propertyInfo);
            }
            else {
                if (mustPush)
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
                objectType: "method",
                name: memberSymbol.getName(),
                returnType,
                params,
                visibility,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? member.getText() : undefined,
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
try {
    const fileNames = ts.sys.readDirectory(rootDir, ["ts"]);
    const options = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS
    };
    const program = ts.createProgram(fileNames, options);
    const checker = program.getTypeChecker();
    const classInfos = {};
    for (const fileName of fileNames) {
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile) {
            ts.forEachChild(sourceFile, (node) => {
                if (node) {
                    const classInfo = visit(node, checker);
                    if (classInfo) {
                        let relativePath = path.relative(rootDir, fileName);
                        relativePath = relativePath.substring(0, relativePath.length - 3);
                        if (classInfo.objectType === "class") {
                            classInfo.filePath = relativePath.split("\\").join(".");
                        }
                        const segments = relativePath.split(path.sep);
                        let currentObject = classInfos;
                        for (let i = 0; i < segments.length; i++) {
                            const segment = segments[i];
                            if (i === segments.length - 1) {
                                if (!currentObject[segment]) {
                                    currentObject[segment] = [];
                                }
                                currentObject[segment].push(classInfo);
                                /*
                                if (classInfo.name === "Vec3") {
                                    console.log(`Added class info for ${segment} ${classInfo.name} to classInfos`);
                                    console.log("classInfos after adding class info: ", classInfos);
                                }
                                */
                            }
                            else {
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
    //console.log(classInfos);
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
    fs.writeFileSync(path.join(outputDir, outputFileName), json);
}
catch (e) {
    console.error("Error  : ", e);
    process.exit(1);
}
