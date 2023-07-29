#!/usr/bin/env node
import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

const rootDir = process.argv[2] || "../xgpu/src/xGPU";
const outputDir = process.argv[3] || "./";
const outputFileName = process.argv[4] || "documentation.json";
const useRawText = process.argv[5] !== 'false';


type ObjectType = "type" | "function" | "variable" | "property" | "method" | "class" | "enum" | "constructor";

interface ObjectInfo {
    objectType: ObjectType;
    jsDoc?: JsDocInfo;
    rawText?: string;
}

type ConstructorInfo = ObjectInfo & {
    name: string,
    params?: { name: string, type: string }[],
}



type EnumMemberInfo = {
    name: string,
    value?: string | number,
    jsDoc?: JsDocInfo,
    rawText?: string
}

type EnumInfo = ObjectInfo & {
    name: string,
    members: EnumMemberInfo[],
}

type JsDocInfo = {
    description?: string,
    params?: { [key: string]: string },
    returns?: string,
    examples?: string[],
};

type TypeAliasInfo = ObjectInfo & {
    name: string,
    type: string,
}

type FunctionInfo = ObjectInfo & {
    name: string,
    returnType: string,
    params: string,
}

type VariableInfo = ObjectInfo & {
    name: string,
    type: string,
}

type PropertyInfo = ObjectInfo & {
    name: string,
    type: string,
    visibility: "public" | "private" | "protected",
    value?: string,
    get?: boolean,
    set?: boolean,
}

type MethodInfo = ObjectInfo & {
    name: string,
    returnType: string,
    visibility: "public" | "private" | "protected",
    params?: { name: string, type: string }[],
}

type ClassInfo = ObjectInfo & {
    name: string,
    constructor?: ConstructorInfo,
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
    functions?: FunctionInfo[],
    variables?: VariableInfo[],
}

function getImplementedInterfaces(node: ts.ClassDeclaration | ts.InterfaceDeclaration, checker: ts.TypeChecker): string[] {
    const interfaces: Set<string> = new Set();

    if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                for (const type of clause.types) {
                    const symbol = checker.getSymbolAtLocation(type.expression);
                    if (symbol) {
                        console.log(symbol.name)
                        interfaces.add(symbol.name);
                    }
                }
            }
        }
    }

    return Array.from(interfaces);
}





function getJsDoc(node: ts.Node): JsDocInfo | undefined {
    const jsDocTags = ts.getJSDocTags(node);
    if (jsDocTags.length === 0) {
        return undefined;
    }

    const jsDoc: JsDocInfo = {};

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
                if (tag as ts.JSDocParameterTag) {
                    const paramName = (tag as ts.JSDocParameterTag).name.getText();
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



function visit(node: ts.Node, checker: ts.TypeChecker) {
    if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node)) {

        if (ts.isEnumDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol) {
                return;
            }

            const enumInfo: EnumInfo = {
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

                let memberValue: string | number | undefined;
                if (member.initializer) {
                    if (ts.isNumericLiteral(member.initializer)) {
                        memberValue = Number(member.initializer.text);
                    } else if (ts.isStringLiteral(member.initializer)) {
                        memberValue = member.initializer.text;
                    } else {
                        // Pour les autres types d'expressions, vous pouvez utiliser le type checker pour obtenir leur valeur
                        const type = checker.getTypeAtLocation(member.initializer);
                        const symbol = type.getSymbol();
                        if (symbol) {
                            memberValue = symbol.getName();
                        }
                    }
                }

                const enumMemberInfo: EnumMemberInfo = {
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
            const typeAliasInfo: TypeAliasInfo = {
                objectType: "type",
                name: symbol.getName(),
                type: checker.typeToString(type),
                jsDoc: getJsDoc(node),
                rawText: useRawText ? node.getText() : undefined,
            };

            return typeAliasInfo;
        }


        if (ts.isFunctionDeclaration(node)) {
            const symbol = checker.getSymbolAtLocation(node.name!);
            if (!symbol) {
                return;
            }

            const signature = checker.getSignatureFromDeclaration(node);
            const returnType = checker.typeToString(signature!.getReturnType());
            const params = signature!.parameters.map(p => checker.typeToString(checker.getTypeAtLocation(p.valueDeclaration!))).join(', ');

            const functionInfo: FunctionInfo = {
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
            const symbol = checker.getSymbolAtLocation(node.name!);
            if (!symbol) {
                return;
            }

            const type = checker.getTypeAtLocation(node);
            const variableInfo: VariableInfo = {
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

    const symbol = checker.getSymbolAtLocation(node.name!);
    if (!symbol) {
        return;
    }

    const details = checker.getTypeAtLocation(node);

    const classInfo: ClassInfo = {
        objectType: "class",
        name: symbol.getName(),
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

            const signature = checker.getSignatureFromDeclaration(member as ts.ConstructorDeclaration);
            const params = signature!.parameters.map(paramSymbol => {
                const paramDeclaration = paramSymbol.valueDeclaration as ts.ParameterDeclaration;
                return {
                    name: paramSymbol.getName(),
                    type: checker.typeToString(checker.getTypeAtLocation(paramDeclaration))
                };
            });

            const constructorInfo: ConstructorInfo = {
                objectType: "constructor",
                name: "constructor",
                params,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? (member as ts.ConstructorDeclaration).getText() : undefined,
            };

            classInfo.constructor = constructorInfo as any;
        }

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
                objectType: "property",
                name: memberSymbol.getName(),
                type: checker.typeToString(type),
                visibility,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? member.getText() : undefined,
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
                objectType: "method",
                name: memberSymbol.getName(),
                returnType,
                params,
                visibility,
                jsDoc: getJsDoc(member),
                rawText: useRawText ? member.getText() : undefined,
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


try {



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


    //console.log(classInfos);

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
    fs.writeFileSync(path.join(outputDir, outputFileName), json);

} catch (e) {

    console.error("Error  : ", e);
    process.exit(1);

}



