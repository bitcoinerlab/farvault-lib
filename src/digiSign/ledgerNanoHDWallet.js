import Transport from '@ledgerhq/hw-transport-webusb';
import AppBtc from '@ledgerhq/hw-app-btc';

import { digiSignMessage } from './digiSignMessage';
import { getDerivationPath } from './derivationPath';

export async function deriveAddressAndSign({
  realm,
  userIndex = 0,
  nonce,
  cnonce,
  body
}) {
  const message = digiSignMessage({ realm, nonce, cnonce, body });
  //const derivationPath = "199'/0'/1'/0/88";
  const derivationPath = getDerivationPath(realm);

  const transport = await Transport.create();
  const btc = new AppBtc(transport);
  const { bitcoinAddress: address } = await btc.getWalletPublicKey(
    derivationPath,
    {
      //https://github.com/LedgerHQ/ledgerjs/issues/799
      verify: false,
      format: 'bech32'
    }
  );
  const result = await btc.signMessageNew(
    derivationPath,
    Buffer.from(message).toString('hex')
  );

  const v = result['v'] + 27 + 4;
  const signature = Buffer.from(
    v.toString(16) + result['r'] + result['s'],
    'hex'
  ).toString('base64');

  return { address, signature };
}
