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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("./index");
function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: schema <file.schema>');
        console.log('\nSchemA - A DSL for Data Structures and Algorithms');
        process.exit(1);
    }
    const filename = args[0];
    const filepath = path.resolve(filename);
    if (!fs.existsSync(filepath)) {
        console.error(`Error: File not found: ${filename}`);
        process.exit(1);
    }
    const code = fs.readFileSync(filepath, 'utf-8');
    try {
        const output = (0, index_1.run)(code);
        console.log('\n--- Program Output ---');
        output.forEach((line) => console.log(line));
    }
    catch (error) {
        console.error('Runtime Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
main();
