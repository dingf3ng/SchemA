const { Lexer, Parser } = require('./packages/core/dist/index.js');

const code = `
fn add(a, b) {
  return a + b
}
`;

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log('Tokens:', tokens.map(t => `${t.type}:${t.value}`));

  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
