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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeChecker = exports.Interpreter = exports.AntlrParser = void 0;
exports.run = run;
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const typechecker_1 = require("./typechecker");
var parser_2 = require("./parser");
Object.defineProperty(exports, "AntlrParser", { enumerable: true, get: function () { return parser_2.AntlrParser; } });
var interpreter_2 = require("./interpreter");
Object.defineProperty(exports, "Interpreter", { enumerable: true, get: function () { return interpreter_2.Interpreter; } });
var typechecker_2 = require("./typechecker");
Object.defineProperty(exports, "TypeChecker", { enumerable: true, get: function () { return typechecker_2.TypeChecker; } });
__exportStar(require("./types"), exports);
__exportStar(require("./runtime/values"), exports);
__exportStar(require("./runtime/data-structures"), exports);
// New ANTLR-based API (recommended)
function run(code) {
    const parser = new parser_1.AntlrParser();
    const ast = parser.parse(code);
    const typeChecker = new typechecker_1.TypeChecker();
    typeChecker.infer(ast);
    typeChecker.check(ast);
    const interpreter = new interpreter_1.Interpreter();
    return interpreter.evaluate(ast);
}
