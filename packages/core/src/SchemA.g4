grammar SchemA;

// Parser Rules
program
    : statement* EOF
    ;

statement
    : functionDeclaration
    | variableDeclaration
    | assignmentStatement
    | ifStatement
    | whileStatement
    | forStatement
    | returnStatement
    | blockStatement
    | expressionStatement
    ;

functionDeclaration
    : 'fn' IDENTIFIER '(' parameterList? ')' ('->' typeAnnotation)? block
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : IDENTIFIER (':' typeAnnotation)?
    ;

typeAnnotation
    : IDENTIFIER ('<' typeAnnotation (',' typeAnnotation)* '>')?
    ;

variableDeclaration
    : 'let' variableDeclarator (',' variableDeclarator)*
    ;

variableDeclarator
    : IDENTIFIER (':' typeAnnotation)? ('=' expression)?
    ;

assignmentStatement
    : assignmentTarget '=' expression
    ;

assignmentTarget
    : IDENTIFIER
    | memberExpression
    | indexExpression
    ;

ifStatement
    : 'if' expression statement ('else' statement)?
    ;

whileStatement
    : 'while' expression statement
    ;

forStatement
    : 'for' IDENTIFIER 'in' expression statement
    ;

returnStatement
    : 'return' expression?
    ;

blockStatement
    : block
    ;

block
    : '{' statement* '}'
    ;

expressionStatement
    : expression
    ;

expression
    : logicalOr
    ;

logicalOr
    : logicalAnd ('||' logicalAnd)*
    ;

logicalAnd
    : equality ('&&' equality)*
    ;

equality
    : comparison (('==' | '!=') comparison)*
    ;

comparison
    : range (('<' | '<=' | '>' | '>=') range)*
    ;

range
    : shift (('..' | '...') shift?)?
    ;

shift
    : addition (('<<' | '>>') addition)*
    ;

addition
    : multiplication (('+' | '-') multiplication)*
    ;

multiplication
    : unary (('*' | '/' | '/.' | '%') unary)*
    ;

unary
    : ('-' | '!') unary     # UnaryOp
    | ('..' | '...') shift  # PrefixRange
    | postfix               # PostfixExpr
    ;

postfix
    : primary postfixOp*
    ;

postfixOp
    : '(' argumentList? ')'     # CallOp
    | '.' IDENTIFIER             # MemberOp
    | '[' expression ']'         # IndexOp
    ;

argumentList
    : expression (',' expression)*
    ;

primary
    : NUMBER                     # NumberLiteral
    | STRING                     # StringLiteral
    | 'true'                     # TrueLiteral
    | 'false'                    # FalseLiteral
    | IDENTIFIER                 # Identifier
    | arrayLiteral               # ArrayLiteralExpr
    | '(' expression ')'         # ParenExpr
    ;

arrayLiteral
    : '[' (expression (',' expression)*)? ']'
    ;

memberExpression
    : primary ('.' IDENTIFIER)+
    ;

indexExpression
    : primary '[' expression ']'
    ;

// Lexer Rules
NUMBER
    : [0-9]+ ('.' [0-9]+)?
    ;

STRING
    : '"' (~["\\\r\n] | '\\' .)* '"'
    | '\'' (~['\\\r\n] | '\\' .)* '\''
    ;

IDENTIFIER
    : [a-zA-Z_][a-zA-Z0-9_]*
    | '_'
    ;

// Whitespace and Comments
WS
    : [ \t\r\n]+ -> skip
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;
