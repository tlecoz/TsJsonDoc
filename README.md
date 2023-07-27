# TsJsonDoc

TsJsonDoc is a Node.js library that generates JSON documentation from TypeScript files. It empowers developers to build their own custom documentation, free from the constraints of interfaces and output formats imposed by existing documentation solutions.

By traversing TypeScript files in a given directory and its subdirectories, TsJsonDoc generates a JSON object that describes the classes, methods, properties, exported functions, and variables. This approach offers great flexibility, allowing developers to transform, filter, or present the documentation data in a way that best suits their needs.

## Features

- Generates documentation for classes, including properties, methods, base classes, implemented interfaces, and class inheritance hierarchy.
- Recognizes and documents getter and setter methods for class properties.
- Generates documentation for exported functions and variables.
- Takes into account JSDoc comments to provide additional descriptions.
- Generates a JSON object structure that mirrors the source code directory structure.
- Supports class inheritance hierarchy. For each class, it provides a list of all parent classes, not just the immediate parent.

## Usage

TsJsonDoc can be used as a CLI command or as a library in your own code. To use it as a CLI command, install it globally via npm and run it with the path of the root directory as an argument:

```
npx tsjsondoc path/to/your/typescript/source
```

This will generate a `documentation.json` file in the current directory, containing the generated documentation.

The objects described by the json follow this structure :

 ```typescript
 // Function defined outside of a class 
type FunctionInfo = {
    name: string,
    returnType: string,
    params: string,
    jsDoc?: string
}

// Variable defined outside of a class
type VariableInfo = {
    name: string,
    type: string,
    jsDoc?: string
}

// Class
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

// Property of a class
type PropertyInfo = {
    name: string,
    type: string,
    visibility: "public" | "private" | "protected",
    value?: string,
    get?: boolean, // Indicates if the property has a getter method
    set?: boolean, // Indicates if the property has a setter method
    jsDoc?: string
}

// Method of a class
type MethodInfo = {
    name: string,
    returnType: string,
    visibility: "public" | "private" | "protected",
    params?: { name: string, type: string }[],
    jsDoc?: string
}
  ```

## Limitations

TsJsonDoc is designed to generate documentation for classes, exported functions, and variables. It does not support modules, namespaces, global functions, and other TypeScript features. Additionally, it does not generate HTML documentation or other output formats.

## Contributing

Contributions to TsJsonDoc are welcome. If you encounter any issues or have suggestions for improvements, feel free to open an issue or submit a pull request on the project's GitHub repository.