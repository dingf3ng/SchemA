"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeTypedBinderToString = RuntimeTypedBinderToString;
function RuntimeTypedBinderToString(binder) {
    const { value, type } = binder;
    switch (type.static.kind) {
        case 'void':
            return 'undefined';
        case 'int':
        case 'float':
        case 'string':
        case 'poly':
        case 'boolean':
        case 'array':
        case 'map':
        case 'set':
        case 'heap':
        case 'heapmap':
        case 'binarytree':
        case 'avltree':
        case 'graph':
        case 'range':
            return value.toString();
        case 'tuple': {
            const values = value;
            const types = type.static.elementTypes;
            return `(${values.map((v) => RuntimeTypedBinderToString(v)).join(', ')})`;
        }
        case 'record': {
            const values = value;
            const fields = Array.from(values.entries())
                .map(([k, v]) => {
                return `${RuntimeTypedBinderToString(k)}: ${RuntimeTypedBinderToString(v)}`;
            })
                .join(', ');
            return `{ ${fields} }`;
        }
        case 'function':
            return '<function>';
        case 'union':
            const unionTypes = type.static.types;
            return `union<${unionTypes.map(t => t.kind).join(' | ')}>`;
        case 'intersection':
            const intersectionTypes = type.static.types;
            return `intersection<${intersectionTypes.map(t => t.kind).join(' & ')}>`;
        case 'weak':
            throw new Error('Internal Error: Weak polymorphic type should not appear at runtime');
        default:
            const _exhaustiveCheck = type.static;
            throw new Error('Internal Error: Unknown type in RuntimeTypedBinderToString');
    }
}
