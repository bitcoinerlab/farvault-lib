export const fixtures = {
  createRelativeTimeLockScript: {
    inputData: {
      maturedPublicKey: Buffer.from(
        '027c3591221e28939e45f8ea297d62c3640ebb09d7058b01d09c963d984a40ad49',
        'hex'
      ),
      rushedPublicKey: Buffer.from(
        '02b3e3e297165289611a2387e8089fcaf099926e4d31fdddb50c0ae0dfa36c97e6',
        'hex'
      ),
      //{ seconds: 2048 }
      encodedLockTime: 0x00400004
    }
  }
};
