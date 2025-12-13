export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'LET'
  | 'FN'
  | 'IF'
  | 'ELSE'
  | 'WHILE'
  | 'FOR'
  | 'IN'
  | 'RETURN'
  | 'TRUE'
  | 'FALSE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'COLON'
  | 'SEMICOLON'
  | 'ARROW'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'EQ'
  | 'EQEQ'
  | 'NEQ'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'DOT'
  | 'LESS'
  | 'GREATER'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

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
  | 'IntegerLiteral'
  | 'FloatLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'ArrayLiteral'
  | 'MapLiteral'
  | 'SetLiteral'
  | 'IfStatement'
  | 'WhileStatement'
  | 'ForStatement'
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
  initializer?: Expression;
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

export interface MapLiteral extends ASTNode {
  type: 'MapLiteral';
  entries: Array<{ key: Expression; value: Expression }>;
}

export interface SetLiteral extends ASTNode {
  type: 'SetLiteral';
  elements: Expression[];
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

export interface TypeAnnotation extends ASTNode {
  type: 'TypeAnnotation';
  name: string;
  typeParameters?: TypeAnnotation[];
}

export type Statement =
  | FunctionDeclaration
  | VariableDeclaration
  | AssignmentStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BlockStatement
  | ExpressionStatement;

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | RangeExpression
  | Identifier
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | BooleanLiteral
  | ArrayLiteral
  | MapLiteral
  | SetLiteral;
