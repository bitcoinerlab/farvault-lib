/** @module serialization */

import fs from 'fs';
import path from 'path';

export function readSetup() {
  const file = path.resolve(process.cwd(), 'setup.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file));
  } else return false;
}

export function writeSetup(setup) {
  const file = path.resolve(process.cwd(), 'setup.json');
  fs.writeFileSync(file, JSON.stringify(setup));
}
