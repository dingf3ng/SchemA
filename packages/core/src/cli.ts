#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { runWithoutTypeCheck } from './index';

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
    const output = runWithoutTypeCheck(code);
    console.log('\n--- Program Output ---');
    output.forEach((line) => console.log(line));
  } catch (error) {
    console.error('Runtime Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
