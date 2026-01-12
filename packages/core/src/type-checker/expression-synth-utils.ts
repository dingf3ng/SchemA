/**
 * Shared expression type synthesis logic.
 * This module provides a unified function for synthesizing types from expressions,
 * used by TypeInferer, TypeChecker, and TypeRefiner.
 */

import { Expression, StringLiteral } from '../transpiler/ast-types';
import { synthMemberExpression } from './member-utils';
import { Type, typesEqual, typeToString } from './type-checker-utils';

/**
 * Context for looking up types and function information.
 */
export interface TypeSynthContext {
  /** Look up variable type by name */
  getVariableType(name: string): Type | undefined;
  /** Look up function info by name */
  getFunctionInfo(name: string): { parameters: Type[]; returnType: Type; variadic?: boolean } | undefined;
  /** Cache for type equality checks */
  typeEqualityCache: Map<string, boolean>;
}

/**
 * Synthesize the type of an expression.
 * This is the unified implementation used by all type checking phases.
 */
export function synthExpression(
  expr: Expression,
  ctx: TypeSynthContext,
): Type {
  const recurse = (e: Expression) => synthExpression(e, ctx);

  switch (expr.type) {
    case 'IntegerLiteral':
      return { kind: 'int' };

    case 'FloatLiteral':
      return { kind: 'float' };

    case 'StringLiteral':
      return { kind: 'string' };

    case 'BooleanLiteral':
      return { kind: 'boolean' };

    case 'Identifier': {
      const type = ctx.getVariableType(expr.name);
      if (type) {
        return type;
      }
      throw new Error(`Type checking: undefined variable ${expr.name}, at ${expr.line}, ${expr.column}`);
    }

    case 'MetaIdentifier':
      return { kind: 'string' };

    case 'ArrayLiteral': {
      if (expr.elements.length === 0) {
        return { kind: 'array', elementType: { kind: 'weak' } };
      }
      const elementTypes = expr.elements.map(recurse);
      const firstType = elementTypes[0];
      const allSame = elementTypes.every((t) => typesEqual(t, firstType, ctx.typeEqualityCache));

      if (allSame) {
        return { kind: 'array', elementType: firstType };
      }
      throw new Error(
        `Type checking: array elements must be of the same type. At ${expr.line}, ${expr.column}`
      );
    }

    case 'MapLiteral': {
      if (expr.entries.length === 0) {
        return { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
      }
      const keyTypes = expr.entries.map((e) => recurse(e.key));
      const valueTypes = expr.entries.map((e) => recurse(e.value));
      const firstKeyType = keyTypes[0];
      const firstValueType = valueTypes[0];
      const allKeysSame = keyTypes.every((t) => typesEqual(t, firstKeyType, ctx.typeEqualityCache));
      const allValuesSame = valueTypes.every((t) => typesEqual(t, firstValueType, ctx.typeEqualityCache));

      if (allKeysSame && allValuesSame) {
        return { kind: 'map', keyType: firstKeyType, valueType: firstValueType };
      }
      throw new Error(
        `Type checking: map keys and values must be of the same type. At ${expr.line}, ${expr.column}`
      );
    }

    case 'SetLiteral': {
      if (expr.elements.length === 0) {
        return { kind: 'set', elementType: { kind: 'weak' } };
      }
      const elementTypes = expr.elements.map(recurse);
      const firstType = elementTypes[0];
      const allSame = elementTypes.every((t) => typesEqual(t, firstType, ctx.typeEqualityCache));

      if (allSame) {
        return { kind: 'set', elementType: firstType };
      }
      throw new Error(
        `Type checking: set elements must be of the same type. At ${expr.line}, ${expr.column}`
      );
    }

    case 'BinaryExpression': {
      const leftType = recurse(expr.left);
      const rightType = recurse(expr.right);

      // Handle dynamic types - operations on dynamic types produce dynamic results
      if (leftType.kind === 'dynamic' || rightType.kind === 'dynamic') {
        if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
          return { kind: 'boolean' };
        }
        if (expr.operator === '/') {
          return { kind: 'int' };
        }
        if (expr.operator === '/.') {
          return { kind: 'float' };
        }
        return { kind: 'dynamic' }
      }

      // Handle weak types - they are polymorphic placeholders that haven't been refined yet
      // During inference, weak types should be allowed to participate in operations
      // The result type is weak until refinement determines the concrete types
      if (leftType.kind === 'weak' || rightType.kind === 'weak') {
        if (['<', '<=', '>', '>=', '==', '!=', '&&', '||', 'and', 'or'].includes(expr.operator)) {
          return { kind: 'boolean' };
        }
        if (expr.operator === '/') {
          return { kind: 'int' };
        }
        if (expr.operator === '/.') {
          return { kind: 'float' };
        }
        return { kind: 'weak' };
      }

      // Arithmetic operators: +, -, *, %
      if (['+', '-', '*', '%'].includes(expr.operator)) {
        if (leftType.kind === 'int' && rightType.kind === 'int') {
          return { kind: 'int' };
        }
        if ((leftType.kind === 'float' && rightType.kind === 'int') ||
          (leftType.kind === 'int' && rightType.kind === 'float') ||
          (leftType.kind === 'float' && rightType.kind === 'float')) {
          return { kind: 'float' };
        }
        // String concatenation
        if (expr.operator === '+' && leftType.kind === 'string' && rightType.kind === 'string') {
          return { kind: 'string' };
        }
        throw new Error(
          `Type checking: invalid binary operation, ${typeToString(leftType)} ${expr.operator} ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      // Integer division: /
      if (expr.operator === '/') {
        if (leftType.kind === 'int' && rightType.kind === 'int') {
          return { kind: 'int' };
        }

        throw new Error(
          `Type checking: integer division requires int operands, got ${typeToString(leftType)} / ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      // Float division: /.
      if (expr.operator === '/.') {
        if (
          (leftType.kind === 'float' || leftType.kind === 'int') && 
          (rightType.kind === 'float' || rightType.kind === 'int')) {
          return { kind: 'float' };
        }
        throw new Error(
          `Type checking: float division requires numeric (int or float) operands, got ${typeToString(leftType)} /. ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      // Bitwise shift operators: << and >>
      if (['<<', '>>'].includes(expr.operator)) {
        if (leftType.kind === 'int' && rightType.kind === 'int') {
          return { kind: 'int' };
        }
        throw new Error(
          `Type checking: bitwise shift requires int operands, got ${typeToString(leftType)} ${expr.operator} ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      // Comparison operators: <, <=, >, >=
      if (['<', '<=', '>', '>='].includes(expr.operator)) {
        const leftNumeric = leftType.kind === 'int' || leftType.kind === 'float';
        const rightNumeric = rightType.kind === 'int' || rightType.kind === 'float';
        if (leftNumeric && rightNumeric) {
          return { kind: 'boolean' };
        }
        throw new Error(
          `Type checking: comparison requires numeric operands, got ${typeToString(leftType)} ${expr.operator} ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      // Equality operators: ==, !=
      if (['==', '!='].includes(expr.operator)) {
        return { kind: 'boolean' };
      }

      // Logical operators: &&, ||
      if (['&&', '||'].includes(expr.operator)) {
        if (leftType.kind === 'boolean' && rightType.kind === 'boolean') {
          return { kind: 'boolean' };
        }
        throw new Error(
          `Type checking: logical operators require boolean operands, got ${typeToString(leftType)} ${expr.operator} ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }
      throw new Error(`Type checking: unknown binary operator ${expr.operator}, at ${expr.line}, ${expr.column}`);
    }

    case 'UnaryExpression': {
      const operandType = recurse(expr.operand);

      if (expr.operator === '-') {
        if (operandType.kind === 'int') {
          return { kind: 'int' };
        } else if (operandType.kind === 'float') {
          return { kind: 'float' };
        } else if (operandType.kind === 'dynamic') {
          return { kind: 'dynamic' };
        }
        throw new Error(
          `Type checking: unary minus requires numeric operand, got ${typeToString(operandType)}, at ${expr.line}, ${expr.column}`
        );
      }

      if (expr.operator === '!') {
        if (operandType.kind === 'dynamic') {
          return { kind: 'boolean' };
        }
        if (operandType.kind === 'boolean') {
          return { kind: 'boolean' };
        }
        throw new Error(
          `Type checking: logical not requires boolean operand, got ${typeToString(operandType)}, at ${expr.line}, ${expr.column}`
        );
      }
      throw new Error(`Type checking: unknown unary operator ${expr.operator}, at ${expr.line}, ${expr.column}`);
    }

    case 'CallExpression': {
      const callee = expr.callee;

      // Special case: MetaIdentifier callee means this is a predicate call
      if (callee.type === 'MetaIdentifier') {
        return { kind: 'predicate' };
      }

      // Function call by name
      if (callee.type === 'Identifier') {
        const calleeName = callee.name;

        // Built-in constructors
        if (calleeName === 'MinHeap' || calleeName === 'MaxHeap') {
          return { kind: 'heap', elementType: { kind: 'weak' } };
        }
        if (calleeName === 'MinHeapMap' || calleeName === 'MaxHeapMap') {
          return { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
        }
        if (calleeName === 'Map') {
          return { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
        }
        if (calleeName === 'Set') {
          return { kind: 'set', elementType: { kind: 'weak' } };
        }
        if (calleeName === 'Graph') {
          return { kind: 'graph', nodeType: { kind: 'weak' } };
        }
        if (calleeName === 'BinaryTree') {
          return { kind: 'binarytree', elementType: { kind: 'weak' } };
        }

        // User-defined function
        const funcInfo = ctx.getFunctionInfo(calleeName);
        if (funcInfo) {
          // Validate argument types against parameter types
          const argTypes = expr.arguments.map(recurse);
          if (!funcInfo.variadic) {
            for (let i = 0; i < Math.min(argTypes.length, funcInfo.parameters.length); i++) {
              if (!typesEqual(argTypes[i], funcInfo.parameters[i], ctx.typeEqualityCache)) {
                throw new Error(
                  `Type mismatch in function call '${calleeName}': argument ${i + 1} expected ${typeToString(funcInfo.parameters[i])}, got ${typeToString(argTypes[i])}. At ${expr.line}, ${expr.column}`
                );
              }
            }
          }
          return funcInfo.returnType;
        }
        throw new Error(`Type checking: undefined function ${calleeName}, at ${callee.line}, ${callee.column}`);
      }

      // Method call
      if (callee.type === 'MemberExpression') {
        const objectType = recurse(callee.object);
        try {
          const methodType = synthMemberExpression(callee, objectType);
          if (methodType.kind === 'function') {
            // Validate argument types against method parameter types
            const argTypes = expr.arguments.map(recurse);
            for (let i = 0; i < Math.min(argTypes.length, methodType.parameters.length); i++) {
              if (!typesEqual(argTypes[i], methodType.parameters[i], ctx.typeEqualityCache)) {
                throw new Error(
                  `Type mismatch in method call '${callee.property.name}': argument ${i + 1} expected ${typeToString(methodType.parameters[i])}, got ${typeToString(argTypes[i])}. At ${expr.line}, ${expr.column}`
                );
              }
            }
            return methodType.returnType;
          }
          return methodType;
        } catch (e) {
          throw e;
        }
      }
      throw new Error(`Type checking: cannot call expression of type ${callee.type}, at ${expr.line}, ${expr.column}`);
    }

    case 'MemberExpression': {
      const objectType = recurse(expr.object);
      if (objectType.kind === 'dynamic') {
        return { kind: 'dynamic' };
      }
      try {
        return synthMemberExpression(expr, objectType);
      } catch (e) {
        throw e;
      }
    }

    case 'IndexExpression': {
      const objectType = recurse(expr.object);
      const indexType = recurse(expr.index);

      if (objectType.kind === 'dynamic' || indexType.kind === 'dynamic') {
        return { kind: 'dynamic' };
      }

      // Handle weak types - during inference, we may not know the concrete type yet
      if (objectType.kind === 'weak' || indexType.kind === 'weak') {
        return { kind: 'weak' };
      }

      if (objectType.kind === 'array') {
        if (indexType.kind === 'int') {
          return objectType.elementType;
        } else if (indexType.kind === 'array' && indexType.elementType.kind === 'int') {
          // Range expression returns array<int>, so this covers ranges
          return objectType; // Slicing returns an array of the same type
        } else if (indexType.kind === 'range') {
          return objectType;
        } else {
          throw new Error(
            `Type checking: cannot index array with type "${typeToString(indexType)}"}, at ${expr.line}, ${expr.column}`,
          );
        }
      } else if (objectType.kind === 'map') {
        // Check that index type matches map key type
        if (typesEqual(indexType, objectType.keyType, ctx.typeEqualityCache)) {
          return objectType.valueType;
        } else {
          throw new Error(
            `Type checking: cannot index map with key of type ${typeToString(indexType)}, expected ${typeToString(objectType.keyType)}, at ${expr.line}, ${expr.column}`,
          );
        }
      } else if (objectType.kind === 'tuple') {
        // Tuples are indexed by integers
        if (indexType.kind !== 'int') {
          throw new Error(
            `Type checking: cannot index tuple with non-integer type ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
          );
        } else {
          // For literal integer indices, return the specific element type
          if (expr.index.type === 'IntegerLiteral') {
            const idx = expr.index.value;
            if (idx >= 0 && idx < objectType.elementTypes.length) {
              return objectType.elementTypes[idx];
            } else {
              throw new Error(
                `Type checking: tuple index ${idx} out of bounds (length: ${objectType.elementTypes.length}), at ${expr.line}, ${expr.column}`,
              );
            }
          } else {
            return { kind: 'dynamic' }
          }
        }

      } else if (objectType.kind === 'record') {
        // Records can be indexed by strings corresponding to field names
        if (indexType.kind !== 'string') {
          throw new Error(
            `Type checking: cannot index record with non-string type ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
          );
        } else {
          // For literal string indices, return the specific field type
          if (expr.index.type === 'StringLiteral') {
            const fieldName = expr.index.value;
            for (const [name, fieldType] of objectType.fieldTypes) {
              if (name === fieldName) {
                return fieldType;
              }
            }
            throw new Error(
              `Type checking: record has no field named "${fieldName}", at ${expr.line}, ${expr.column}`,
            );
          } else {
            return { kind: 'dynamic' }
          }
        }
      } else {
        throw new Error(
          `Type checking: cannot index type ${typeToString(objectType)}, at ${expr.line}, ${expr.column}`,
        );
      }
    }

    case 'RangeExpression': {
      if (expr.start) {
        const startType = recurse(expr.start);
        if (startType.kind === 'dynamic') {
          return { kind: 'dynamic' };
        } else if (startType.kind === 'weak') {
          // During inference, allow weak types - will be refined later
          return { kind: 'weak' };
        } else {
          if (expr.end) {
            const endType = recurse(expr.end);
            if (endType.kind === 'dynamic') {
              return { kind: 'dynamic' };
            }
            if (endType.kind === 'weak') {
              // During inference, allow weak types - will be refined later
              return { kind: 'weak' };
            }
            // Finite range
            if (startType.kind === 'int' && endType.kind === 'int') {
              return { kind: 'array', elementType: { kind: 'int' } };
            } else if (startType.kind === 'string' && endType.kind === 'string') {
              return { kind: 'array', elementType: { kind: 'string' } };
            }
            throw new Error(
              `Type checking: range start and end must be the same type (int or string), at ${expr.line}, ${expr.column}`
            );
          } else {
            // Infinite range
            if (startType.kind === 'int') {
              return { kind: 'range' };
            }
            throw new Error(
              `Type checking: infinite ranges are only supported for integers, at ${expr.line}, ${expr.column}`
            );
          }
        }
      } else if (expr.end) {
        const endType = recurse(expr.end);
        if (endType.kind === 'dynamic') {
          return { kind: 'dynamic' };
        } else if (endType.kind === 'weak') {
          // During inference, allow weak types - will be refined later
          return { kind: 'weak' };
        } else if (endType.kind === 'int') {
          return { kind: 'array', elementType: { kind: 'int' } };
        }
        throw new Error(
          `Type checking: range with default start (0) requires integer end, at ${expr.line}, ${expr.column}`
        );
      }
      throw new Error(
        `Type checking: range must have at least a start or end, at ${expr.line}, ${expr.column}`
      );
    }

    case 'TypeOfExpression':
      return { kind: 'string' };

    case 'PredicateCheckExpression':
      return { kind: 'boolean' };

    default:
      const _exhaustiveCheck: never = expr;
      throw new Error(`Type checking: unhandled expression type ${(_exhaustiveCheck as any).type}`);
  }
}
