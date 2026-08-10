import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['app', 'scripts', 'tests'];
const files = ['sw.js'];
const pythonFiles = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (/\.(?:c?js|mjs)$/.test(entry.name)) files.push(target);
    else if (/\.py$/.test(entry.name)) pythonFiles.push(target);
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) collect(root);
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

if (pythonFiles.length) {
  const result = spawnSync(
    'python',
    [
      '-c',
      'import pathlib,sys; [compile(pathlib.Path(p).read_text(encoding="utf-8"), p, "exec") for p in sys.argv[1:]]',
      ...pythonFiles.sort(),
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log(
  `Đã kiểm tra cú pháp ${files.length} tệp JavaScript và ${pythonFiles.length} tệp Python.`,
);
