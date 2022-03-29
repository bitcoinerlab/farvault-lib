export function digiSignMessage({
  realm = '',
  nonce = '',
  cnonce = '',
  body = ''
}) {
  return `${realm}:${nonce}:${cnonce}:${body}`;
}
