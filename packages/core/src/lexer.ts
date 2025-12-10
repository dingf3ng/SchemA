import { Token, TokenType } from './types';

const KEYWORDS: Record<string, TokenType> = {
  let: 'LET',
  fn: 'FN',
  if: 'IF',
  else: 'ELSE',
  while: 'WHILE',
  for: 'FOR',
  in: 'IN',
  return: 'RETURN',
  true: 'TRUE',
  false: 'FALSE',
};

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private currentChar: string | null;

  constructor(input: string) {
    this.input = input;
    this.currentChar = this.input.length > 0 ? this.input[0] : null;
  }

  private advance(): void {
    this.position++;
    if (this.currentChar === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(offset: number = 1): string | null {
    const peekPos = this.position + offset;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private skipComment(): void {
    if (this.currentChar === '/' && this.peek() === '/') {
      this.advance(); // skip first /
      this.advance(); // skip second /
      while (this.currentChar && (this.currentChar as string) !== '\n') {
        this.advance();
      }
    }
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let numStr = '';

    while (this.currentChar && /[0-9]/.test(this.currentChar)) {
      numStr += this.currentChar;
      this.advance();
    }

    if (this.currentChar === '.') {
      numStr += this.currentChar;
      this.advance();
      while (this.currentChar && /[0-9]/.test(this.currentChar)) {
        numStr += this.currentChar;
        this.advance();
      }
    }

    return {
      type: 'NUMBER',
      value: numStr,
      line: startLine,
      column: startColumn,
    };
  }

  private readString(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let str = '';
    const quote = this.currentChar;
    this.advance(); // skip opening quote

    while (this.currentChar && this.currentChar !== quote) {
      if (this.currentChar === '\\') {
        this.advance();
        if (this.currentChar !== null) {
          const ch: string = this.currentChar;
          if (ch === 'n') {
            str += '\n';
          } else if (ch === 't') {
            str += '\t';
          } else if (ch === 'r') {
            str += '\r';
          } else if (ch === '\\') {
            str += '\\';
          } else if (ch === quote) {
            str += quote;
          } else {
            str += ch;
          }
          this.advance();
        }
      } else {
        str += this.currentChar;
        this.advance();
      }
    }

    if (this.currentChar === quote) {
      this.advance(); // skip closing quote
    }

    return {
      type: 'STRING',
      value: str,
      line: startLine,
      column: startColumn,
    };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let id = '';

    while (this.currentChar && /[a-zA-Z0-9_]/.test(this.currentChar)) {
      id += this.currentChar;
      this.advance();
    }

    const type = KEYWORDS[id] || 'IDENTIFIER';

    return {
      type,
      value: id,
      line: startLine,
      column: startColumn,
    };
  }

  public nextToken(): Token {
    while (this.currentChar) {
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      if (this.currentChar === '/' && this.peek() === '/') {
        this.skipComment();
        continue;
      }

      const line = this.line;
      const column = this.column;

      if (/[0-9]/.test(this.currentChar)) {
        return this.readNumber();
      }

      if (this.currentChar === '"' || this.currentChar === "'") {
        return this.readString();
      }

      if (/[a-zA-Z_]/.test(this.currentChar)) {
        return this.readIdentifier();
      }

      const char = this.currentChar;

      switch (char) {
        case '(':
          this.advance();
          return { type: 'LPAREN', value: char, line, column };
        case ')':
          this.advance();
          return { type: 'RPAREN', value: char, line, column };
        case '{':
          this.advance();
          return { type: 'LBRACE', value: char, line, column };
        case '}':
          this.advance();
          return { type: 'RBRACE', value: char, line, column };
        case '[':
          this.advance();
          return { type: 'LBRACKET', value: char, line, column };
        case ']':
          this.advance();
          return { type: 'RBRACKET', value: char, line, column };
        case ',':
          this.advance();
          return { type: 'COMMA', value: char, line, column };
        case ':':
          this.advance();
          return { type: 'COLON', value: char, line, column };
        case ';':
          this.advance();
          return { type: 'SEMICOLON', value: char, line, column };
        case '.':
          this.advance();
          return { type: 'DOT', value: char, line, column };
        case '+':
          this.advance();
          return { type: 'PLUS', value: char, line, column };
        case '%':
          this.advance();
          return { type: 'PERCENT', value: char, line, column };
        case '*':
          this.advance();
          return { type: 'STAR', value: char, line, column };
        case '/':
          this.advance();
          return { type: 'SLASH', value: char, line, column };
        case '-':
          this.advance();
          if (this.currentChar === '>') {
            this.advance();
            return { type: 'ARROW', value: '->', line, column };
          }
          return { type: 'MINUS', value: char, line, column };
        case '=':
          this.advance();
          if (this.currentChar === '=') {
            this.advance();
            return { type: 'EQEQ', value: '==', line, column };
          }
          return { type: 'EQ', value: char, line, column };
        case '!':
          this.advance();
          if (this.currentChar === '=') {
            this.advance();
            return { type: 'NEQ', value: '!=', line, column };
          }
          return { type: 'NOT', value: char, line, column };
        case '<':
          this.advance();
          if (this.currentChar === '=') {
            this.advance();
            return { type: 'LTE', value: '<=', line, column };
          }
          return { type: 'LT', value: char, line, column };
        case '>':
          this.advance();
          if (this.currentChar === '=') {
            this.advance();
            return { type: 'GTE', value: '>=', line, column };
          }
          return { type: 'GT', value: char, line, column };
        case '&':
          this.advance();
          if (this.currentChar === '&') {
            this.advance();
            return { type: 'AND', value: '&&', line, column };
          }
          throw new Error(`Unexpected character '&' at ${line}:${column}`);
        case '|':
          this.advance();
          if (this.currentChar === '|') {
            this.advance();
            return { type: 'OR', value: '||', line, column };
          }
          throw new Error(`Unexpected character '|' at ${line}:${column}`);
        default:
          throw new Error(
            `Unexpected character '${char}' at ${line}:${column}`
          );
      }
    }

    return {
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
    };
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();

    while (token.type !== 'EOF') {
      tokens.push(token);
      token = this.nextToken();
    }

    tokens.push(token); // Add EOF token
    return tokens;
  }
}
