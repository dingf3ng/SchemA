export type ASTNodeType =
  | 'Program'
  | 'FunctionDeclaration'
  | 'VariableDeclaration'
  | 'AssignmentStatement'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'MemberExpression'
  | 'IndexExpression'
  | 'RangeExpression'
  | 'Identifier'
  | 'MetaIdentifier'
  | 'IntegerLiteral'
  | 'FloatLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'ArrayLiteral'
  | 'MapLiteral'
  | 'SetLiteral'
  | 'TupleLiteral'
  | 'RecordLiteral'
  | 'TypeOfExpression'
  | 'PredicateCheckExpression'
  | 'InvariantStatement'
  | 'AssertStatement'
  | 'IfStatement'
  | 'WhileStatement'
  | 'ForStatement'
  | 'UntilStatement'
  | 'ReturnStatement'
  | 'BlockStatement'
  | 'ExpressionStatement'
  | 'TypeAnnotation';

export interface ASTNode {
  type: ASTNodeType;
  line: number;
  column: number;
}

export interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  parameters: Parameter[];
  returnType?: TypeAnnotation;
  body: BlockStatement;
}

export interface Parameter {
  name: string;
  typeAnnotation?: TypeAnnotation;
}

export interface VariableDeclarator {
  name: string;
  typeAnnotation?: TypeAnnotation;
  initializer: Expression;
  line: number;
  column: number;
}

export interface VariableDeclaration extends ASTNode {
  type: 'VariableDeclaration';
  declarations: VariableDeclarator[];
}

export interface AssignmentStatement extends ASTNode {
  type: 'AssignmentStatement';
  target: Expression;
  value: Expression;
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

export interface RangeExpression extends ASTNode {
  type: 'RangeExpression';
  start?: Expression;
  end?: Expression;
  inclusive: boolean; // true for '...', false for '..'
}

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface MetaIdentifier extends ASTNode {
  type: 'MetaIdentifier';
  name: string;
}

export interface IntegerLiteral extends ASTNode {
  type: 'IntegerLiteral';
  value: number;
}

export interface FloatLiteral extends ASTNode {
  type: 'FloatLiteral';
  value: number;
}

export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral extends ASTNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface TupleLiteral extends ASTNode {
  type: 'TupleLiteral';
  elements: Expression[];
}

export interface RecordLiteral extends ASTNode {
  type: 'RecordLiteral';
  entries: Array<{ key: string; value: Expression }>;
}

export interface MapLiteral extends ASTNode {
  type: 'MapLiteral';
  entries: Array<{ key: Expression; value: Expression }>;
}

export interface SetLiteral extends ASTNode {
  type: 'SetLiteral';
  elements: Expression[];
}

export interface TypeOfExpression extends ASTNode {
  type: 'TypeOfExpression';
  operand: Expression;
}

export interface PredicateCheckExpression extends ASTNode {
  type: 'PredicateCheckExpression';
  subject: Expression;
  predicateName: string;
  predicateArgs?: Expression[]; // Optional arguments for predicates like sorted(asc)
}

export interface InvariantStatement extends ASTNode {
  type: 'InvariantStatement';
  condition: Expression;
  message?: Expression;
}

export interface AssertStatement extends ASTNode {
  type: 'AssertStatement';
  condition: Expression;
  message?: Expression;
}

export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  condition: Expression;
  thenBranch: Statement;
  elseBranch?: Statement;
}

export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement;
}

export interface UntilStatement extends ASTNode {
  type: 'UntilStatement';
  condition: Expression;
  body: Statement;
}

export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement;
}

export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  value?: Expression;
}

export interface BlockStatement extends ASTNode {
  type: 'BlockStatement';
  statements: Statement[];
}

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export type TypeAnnotation =
    SimpleTypeAnnotation
  | GenericTypeAnnotation
  | FunctionTypeAnnotation
  | TupleTypeAnnotation
  | RecordTypeAnnotation;

export interface BaseTypeAnnotation extends ASTNode {
  type: 'TypeAnnotation';
  isInferred?: boolean; // Indicates if this type was inferred rather than explicitly annotated
}

export interface SimpleTypeAnnotation extends BaseTypeAnnotation {
  kind: 'simple';
  name: string;
}

export interface GenericTypeAnnotation extends BaseTypeAnnotation {
  kind: 'generic';
  name: string;
  typeParameters: TypeAnnotation[];
}

export interface FunctionTypeAnnotation extends BaseTypeAnnotation {
  kind: 'function';
  name: string;
  parameterTypes: TypeAnnotation[];
  returnType: TypeAnnotation;
}

export interface TupleTypeAnnotation extends BaseTypeAnnotation {
  kind: 'tuple';
  elementTypes: TypeAnnotation[];
}

export interface RecordTypeAnnotation extends BaseTypeAnnotation {
  kind: 'record';
  fieldTypes: [string, TypeAnnotation][]; // { "set": Set<int>, "map": Map<string, int> }
}

export type Statement =
  | FunctionDeclaration
  | VariableDeclaration
  | AssignmentStatement
  | IfStatement
  | WhileStatement
  | UntilStatement
  | ForStatement
  | ReturnStatement
  | BlockStatement
  | InvariantStatement
  | AssertStatement
  | ExpressionStatement;

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | RangeExpression
  | Identifier
  | MetaIdentifier
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | BooleanLiteral
  | ArrayLiteral
  | MapLiteral
  | SetLiteral
  | TupleLiteral
  | RecordLiteral
  | TypeOfExpression
  | PredicateCheckExpression;
