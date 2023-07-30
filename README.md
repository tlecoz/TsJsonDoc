# TsJsonDoc

TsJsonDoc is a Node.js library that generates JSON documentation from TypeScript files. It empowers developers to build their own custom documentation, free from the constraints of interfaces and output formats imposed by existing documentation solutions.

By traversing TypeScript files in a given directory and its subdirectories, TsJsonDoc generates a JSON object that describes classes, methods, properties, exported functions, variables, type aliases, and enumerations. This approach offers great flexibility, allowing developers to transform, filter, or present the documentation data in a way that best suits their needs.

## Features

- Generates documentation for classes, including properties, methods, base classes, implemented interfaces, and class inheritance hierarchy.
- Recognizes and documents getter and setter methods for class properties.
- Generates documentation for exported functions and variables.
- Generates documentation for type aliases and enumerations.
- Takes into account JSDoc comments to provide additional descriptions.
- Generates a JSON object structure that mirrors the source code directory structure.
- Supports class inheritance hierarchy. For each class, it provides a list of all parent classes, not just the immediate parent.
- Captures raw TypeScript code for each documented item, providing a direct reference to the source code.

## Usage

TsJsonDoc can be used as a CLI command or as a library in your own code. To use it as a CLI command, install it globally via npm and run it with the path of the root directory as an argument:

```
npx tsjsondoc path/to/your/typescript/source [path/to/output/directory] [output_filename] [--raw]
```

By default, this will generate a `documentation.json` file in the current directory, containing the generated documentation. You can specify an output directory and an output filename as the second and third arguments respectively. 

The `--raw` option can be used to include raw TypeScript code in the generated documentation.

The objects described by the json follow this structure:

 ```typescript
 // Function defined outside of a class 
type FunctionInfo = {
    objectType: "function",
    name: string,
    returnType: string,
    params: string,
    filePath:string,
    jsDoc?: JsDocInfo,
    rawText?: string,
    
}

// Variable defined outside of a class
type VariableInfo = {
    objectType: "variable",
    name: string,
    type: string,
    filePath:string,
    jsDoc?: JsDocInfo,
    rawText?: string
}

// Type alias
type TypeAliasInfo = {
    objectType: "type",
    name: string,
    type: string,
    filePath:string,
    jsDoc?: JsDocInfo,
    rawText?: string
}

// Enumeration
type EnumInfo = {
    objectType: "enum",
    name: string,
    filePath:string,
    members: { [key: string]: string | number },
    jsDoc?: JsDocInfo,
    rawText?: string
}

// Class
type ClassInfo = {
    objectType: "class",
    name: string,
    filePath:string,
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
    jsDoc?: JsDocInfo,
    functions?: FunctionInfo[],
    variables?: VariableInfo[],
    types?: TypeAliasInfo[],
    enums?: EnumInfo[],
    rawText?: string
}

// Property of a class
type PropertyInfo = {
    objectType: "property",
    name: string,
    type: string,
    visibility: "public" | "private" | "protected",
    value?: string,
    get?: boolean, // Indicates if the property has a getter method
    set?: boolean, // Indicates if the property has a setter method
    jsDoc?: JsDocInfo,
    rawText?: string
}

// Method of a class
type MethodInfo = {
    objectType: "method",
    name: string,
    returnType: string,
    visibility: "public" | "private" | "protected",
    params?: { name: string, type: string }[],
    jsDoc?: JsDocInfo,
    rawText?: string
}

// JSDoc information
type JsDocInfo = {
    description?: string;
    params?: { [key: string]: string };
    returns?: string;
    examples?: string[];
    rawText?: string;
};
  ```

## Limitations

TsJsonDoc is designed to generate documentation for classes, exported functions, variables, type aliases, and enumerations. It does not support modules, namespaces, global functions, and other TypeScript features. Additionally, it does not generate HTML documentation or other output formats.

## Contributing

Contributions to TsJsonDoc are welcome. If you encounter any issues or have suggestions for improvements, feel free to open an issue or submit a pull request on the project's GitHub repository.