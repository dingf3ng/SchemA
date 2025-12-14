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
    | untilStatement
    | forStatement
    | returnStatement
    | blockStatement
    | expressionStatement
    ;

functionDeclaration
    : 'do' IDENTIFIER '(' parameterList? ')' ('->' typeAnnotation)? block
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : IDENTIFIER (':' typeAnnotation)?
    ;

typeAnnotation
    : unionType
    ;

unionType
    : intersectionType ('|' intersectionType)*
    ;

intersectionType
    : primaryType ('&' primaryType)*
    ;

primaryType
    : POLY_TYPE_ID ('<' typeAnnotation (',' typeAnnotation)* '>')?
    | IDENTIFIER
    | '(' typeAnnotation ')'
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

untilStatement
    : 'until' expression statement
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
    | 'typeof' unary        # TypeOfExpr
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
    | 'assert' '(' expression ',' expression ')'  # AssertExpr
    | POLY_TYPE_ID ('<' typeAnnotation (',' typeAnnotation)* '>')?  # PolyTypeConstructor
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

POLY_TYPE_ID
    : [A-Z][a-zA-Z0-9_]*
    ;

IDENTIFIER
    : [a-z_][a-zA-Z0-9_]*
    | '_'
    ;

// Whitespace and Comments
WS
    : [ \t\r\n]+ -> skip
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;
