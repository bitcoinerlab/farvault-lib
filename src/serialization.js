/** @module serialization - read/write operations on files */

import fs from 'fs';
import path from 'path';

export function readSetup() {
  return JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'setup.json'))
  );
}

export function writeSetup(setup) {
  fs.writeFileSync(
    path.resolve(process.cwd(), 'setup.json'),
    JSON.stringify(setup)
  );
}
