import { crypto } from 'bitcoinjs-lib';

export function getDerivationPath(realm, index = 0) {
  const BIP43_PURPOSE = 13,
    M = 0x7fffffff;
  const indexAndRealmBuffer = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from(realm)
  ]);
  indexAndRealmBuffer.writeInt32LE(index, 0);
  const hash = crypto.sha256(indexAndRealmBuffer);
  const path = [];
  path[0] = BIP43_PURPOSE & M;
  path[1] = hash.slice(0, 4).readUInt32LE(0) & M;
  path[2] = hash.slice(4, 8).readUInt32LE(0) & M;
  path[3] = hash.slice(8, 12).readUInt32LE(0) & M;
  path[4] = hash.slice(12, 16).readUInt32LE(0) & M;
  return `m/${path[0]}'/${path[1]}'/${path[2]}'/${path[3]}'/${path[4]}'`;
}
