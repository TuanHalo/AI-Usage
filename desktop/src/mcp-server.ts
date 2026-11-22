import readline from 'node:readline';
import { handleJsonRpcLine } from './mcp-handler';

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const response = handleJsonRpcLine(line);
  if (response !== null) {
    process.stdout.write(`${response}\n`);
  }
});

rl.on('close', () => {
  process.exit(0);
});
