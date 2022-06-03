import { opcodes } from 'bitcoinjs-lib';
const maturedPublicKey = Buffer.from(
  '027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49',
  'hex'
);
const rushedPublicKey = Buffer.from(
  '02b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6',
  'hex'
);
/* 
Set the script below into
https://siminchen.github.io/bitcoinIDE/build/editor.html
Numbers are assumed to be hex.
Note that OP_NOP3: OP_CHECKSEQUENCEVERIFY.

  027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49
      OP_CHECKSIG
      OP_NOTIF
  02b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6
          OP_CHECKSIG 
      OP_ELSE
  040040
          OP_NOP3
      OP_ENDIF

0x040040 corresponds to: 
script.number.encode(bip68.encode({ seconds: 2048 })).toString('hex')
0x1 corresponds to:
script.number.encode(bip68.encode({ blocks: 1 })).toString('hex')
0x64 corresponds to:
script.number.encode(bip68.encode({ blocks: 100 })).toString('hex')

Get this:
21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6703040040b268


  If bip68 = 1, then use OP_1:

  027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49
      OP_CHECKSIG
      OP_NOTIF
  02b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6
          OP_CHECKSIG 
      OP_ELSE
  OP_1
          OP_NOP3
      OP_ENDIF
 
 If OP_1 gets this:
 21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6751b268


  If bip68 = 0, then use OP_0. This produces an unredeamable script!

  027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49
      OP_CHECKSIG
      OP_NOTIF
  02b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6
          OP_CHECKSIG 
      OP_ELSE
  OP_0
          OP_NOP3
      OP_ENDIF
 
 If OP_0 gets this:
 21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6700b268
*/

const script =
  '21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6703040040b268';
//https://learnmeabitcoin.com/technical/varint
//https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers
const bip68LockTime = 0x00400004; // = bip68.encode({ seconds: 2048 })
//script.number.encode(bip68.encode({ seconds: 2048 })).toString('hex') //= 0x040040
//const bip68LockTime = 0x1;// = bip68.encode({ blocks: 1 }).toString(16)
//script.number.encode(bip68.encode({ blocks: 1 })).toString('hex') //= 0x1
//const bip68LockTime = 0x64;// = bip68.encode({ blocks: 100 }).toString(16)
//script.number.encode(bip68.encode({ blocks: 100 })).toString('hex') //= 0x64

export const fixtures = {
  createRelativeTimeLockScript: {
    valid: [
      {
        description: 'createRelativeTimeLockScript works',
        maturedPublicKey,
        rushedPublicKey,
        bip68LockTime,
        script
      },
      {
        description:
          'createRelativeTimeLockScript works with bip68LockTime 1, which is converted to OP_1',
        maturedPublicKey,
        rushedPublicKey,
        bip68LockTime: 1,
        script:
          '21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6751b268'
      }
    ],
    invalid: [
      {
        description: 'Not setting the maturedPublicKey',
        errorMessage: 'Invalid maturedPublicKey',
        rushedPublicKey,
        bip68LockTime
      },
      {
        description: 'Setting an invalid rushedPublicKey',
        errorMessage: 'Invalid rushedPublicKey',
        maturedPublicKey,
        rushedPublicKey: Buffer.from('ab', 'hex'),
        bip68LockTime
      },
      {
        description: 'Setting an invalid lockTime',
        errorMessage: 'Invalid bip68LockTime',
        maturedPublicKey,
        rushedPublicKey,
        bip68LockTime: null
      },
      {
        description: 'Cannot set zero lock times',
        errorMessage: 'FarVault does not allow sequence to be 0.',
        maturedPublicKey,
        rushedPublicKey,
        bip68LockTime: 0
      }
    ]
  },
  parseRelativeTimeLockScript: {
    valid: [
      {
        description: 'parseRelativeTimeLockScript works',
        returns: { maturedPublicKey, rushedPublicKey, bip68LockTime },
        script
      },
      {
        description:
          'parseRelativeTimeLockScript works with bip68LockTime 1, which is converted to OP_1',
        returns: { maturedPublicKey, rushedPublicKey, bip68LockTime: 1 },
        script:
          '21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6751b268'
      },
      {
        description:
          'parseRelativeTimeLockScript returns false with bip68LockTime 0',
        returns: false,
        script:
          '21027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6700b268'
      },
      {
        description: 'Remove one nibble (4 bits) from a public key',
        script:
          '210273591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49ac642102b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6ac6751b268',
        returns: false
      },
      {
        //Use one of the invalid scripts from bitcoinjs-lig tests:
        //https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/fixtures/script.json
        description: 'Invalid script - Not enough data: OP_PUSHDATA2 0xffff',
        script: '4dffff01',
        returns: false
      },
      {
        description:
          'parseRelativeTimeLockScript returns false when using 0a instead of OP_10 for the bip68LockTime in the script',
        returns: false,
        //Created here: https://siminchen.github.io/bitcoinIDE/build/editor.html
        //Note the 0a (10) instead of OP_10
        //0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296
        //OP_CHECKSIG
        //OP_NOTIF
        //024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1
        //OP_CHECKSIG
        //OP_ELSE
        //0a
        //OP_NOP3
        //OP_ENDIF
        script:
          '210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac67010ab268'
      },
      {
        description: 'parseRelativeTimeLockScript for bip68LockTime > 16',
        returns: false,
        //Created here: https://siminchen.github.io/bitcoinIDE/build/editor.html
        //0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296
        //OP_CHECKSIG
        //OP_NOTIF
        //024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1
        //OP_CHECKSIG
        //OP_ELSE
        //11
        //OP_NOP3
        //OP_ENDIF
        script:
          '210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac670111b268',
        returns: {
          maturedPublicKey: Buffer.from(
            '0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296',
            'hex'
          ),
          rushedPublicKey: Buffer.from(
            '024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1',
            'hex'
          ),
          bip68LockTime: 17
        }
      }
    ],
    invalid: [
      {
        description: 'Wrong script type',
        errorMessage: 'Invalid type for relativeTimeLockScript: number',
        script: 21
      }
    ]
  },
  numberEncodeAsm: {
    valid: [
      { description: 'Encodes zero', number: 0, encoded: 'OP_0' },
      //https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers
      { description: '515', number: 515, encoded: '0x302' }
    ],
    invalid: [
      {
        description: 'Throws on invalid integer',
        number: undefined,
        errorMessage: 'Invalid number'
      }
    ]
  },
  scriptNumberDecode: {
    valid: [
      { description: 'Decodes zero', decompiled: opcodes.OP_0, number: 0 },
      { description: 'Decodes one', decompiled: opcodes.OP_1, number: 1 },
      { description: 'Decodes 16', decompiled: opcodes.OP_16, number: 16 },
      {
        description: 'Decodes 17 (0x11 BE -> 0x11 LE)',
        decompiled: Buffer.from(
          '11',
          'hex'
        ) /*17 is the same in Little & Big Endian*/,
        number: 17
      },
      {
        description: 'Decodes 5000 (0x1388 BE -> 0x8813 LE)',
        decompiled: Buffer.from('8813', 'hex'),
        number: 5000
      }
    ],
    invalid: [
      {
        description: 'Number one should be encoded as OP_1',
        decompiled: Buffer.from('1', 'hex'),
        errorMessage: '0 to 16 should have been compiled using op codes'
      },
      {
        description: 'Number zero should be encoded as OP_0',
        decompiled: Buffer.from('0', 'hex'),
        errorMessage: '0 to 16 should have been compiled using op codes'
      },
      {
        description: 'Number 16 should be encoded as OP_16',
        decompiled: Buffer.from('a', 'hex'),
        errorMessage: '0 to 16 should have been compiled using op codes'
      },
      {
        description:
          'decompiled should only be type number if numbers are in: [0,16], that is [0, 0x51, 0x52, ..., 0x60]. Try with 0x50.',
        decompiled: 0x50,
        errorMessage: 'Invalid decompiled number'
      },
      {
        description:
          'decompiled should only be type number if numbers are in: [0,16], that is [0, 0x51, 0x52, ..., 0x60]. Try with -1.',
        decompiled: -1,
        errorMessage: 'Invalid decompiled number'
      },
      {
        description:
          'decompiled should only be type number if numbers are in: [0,16], that is [0, 0x51, 0x52, ..., 0x60]. Try with 61.',
        decompiled: 0x61,
        errorMessage: 'Invalid decompiled number'
      }
    ]
  }
};
