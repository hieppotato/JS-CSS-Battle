// src/utils/decryptBase64Key.js
// Dùng khi ENCRYPT_SECRET là base64 của 32 bytes raw key,
// tương thích với backend dùng: Buffer.from(process.env.ENCRYPT_SECRET, 'base64')

/** base64 => Uint8Array */
function b64ToUint8Array(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/**
 * Import raw AES-GCM key from base64 (32 bytes).
 * @param {string} base64Key
 * @returns {Promise<CryptoKey>}
 */
async function importAesKeyFromBase64(base64Key) {
  const keyBytes = b64ToUint8Array(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error('Invalid key length; expected 32 bytes after base64 decode.');
  }
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

/**
 * Decrypt payload of form { iv: base64, ct: base64, tag: base64 }
 * using ENCRYPT_SECRET (base64 raw key).
 *
 * @param {{iv:string,ct:string,tag:string}} payload
 * @param {string} base64Key - ENCRYPT_SECRET (base64, 32 bytes)
 * @returns {Promise<any>} parsed JSON payload
 */
export async function decryptPayloadWithBase64Key(payload, base64Key) {
  if (!payload || !payload.iv || !payload.ct || !payload.tag) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = await importAesKeyFromBase64(base64Key);
  const iv = b64ToUint8Array(payload.iv);
  const ct = b64ToUint8Array(payload.ct);
  const tag = b64ToUint8Array(payload.tag);

  // WebCrypto expects ciphertext + tag combined
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    combined.buffer
  );

  const text = new TextDecoder().decode(plainBuf);
  return JSON.parse(text);
}
