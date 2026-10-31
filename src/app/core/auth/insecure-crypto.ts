/**
 * Notbehelf für Tests im lokalen Netz über HTTP. Der Code-Flow mit PKCE braucht `crypto.subtle.digest('SHA-256')`, und das gibt
 * es im Browser nur in einem sicheren Kontext (HTTPS oder `localhost`). Ruft man die App am Handy über `http://192.168.…` auf,
 * fehlt es. Dann ersetzt dieses SHA-256 in reinem JavaScript die fehlende Funktion.
 *
 * Nur einschalten, wenn es nötig ist (`oidc.allowInsecureContext` in `config.json`). Eine Anmeldung über unverschlüsseltes
 * HTTP ist im Betrieb nicht sicher: Dort gehört HTTPS hin, und diese Datei wird dann nicht gebraucht.
 */

const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

/** SHA-256 (FIPS 180-4) über die Bytes. */
export function sha256(message: Uint8Array): Uint8Array {
  const length = message.length;
  // Nachricht, ein 1-Bit, Nullen und die Länge in Bits als 64-Bit-Zahl, aufgefüllt auf ein Vielfaches von 64 Bytes
  const paddedLength = ((length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(length / 0x20000000));
  view.setUint32(paddedLength - 4, (length << 3) >>> 0);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      schedule[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotateRight(schedule[i - 15], 7) ^ rotateRight(schedule[i - 15], 18) ^ (schedule[i - 15] >>> 3);
      const s1 = rotateRight(schedule[i - 2], 17) ^ rotateRight(schedule[i - 2], 19) ^ (schedule[i - 2] >>> 10);
      schedule[i] = schedule[i - 16] + s0 + schedule[i - 7] + s1;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let i = 0; i < 64; i++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + ROUND_CONSTANTS[i] + schedule[i]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] += a;
    state[1] += b;
    state[2] += c;
    state[3] += d;
    state[4] += e;
    state[5] += f;
    state[6] += g;
    state[7] += h;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  state.forEach((word, index) => out.setUint32(index * 4, word));
  return digest;
}

function toBytes(data: BufferSource): Uint8Array {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Setzt `crypto.subtle.digest` für SHA-256, falls der Browser es nicht hat. Gibt zurück, ob etwas eingebaut wurde. Andere
 * Verfahren und Funktionen von `crypto.subtle` gibt es dann nicht (die Bibliothek braucht für den Code-Flow nur dieses).
 */
export function installSha256Fallback(): boolean {
  if (typeof crypto === 'undefined' || crypto.subtle) {
    return false;
  }
  const digest = async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    if (name.toUpperCase() !== 'SHA-256') {
      throw new DOMException(`Nur SHA-256 ist verfügbar, nicht ${name}.`, 'NotSupportedError');
    }
    return sha256(toBytes(data)).slice().buffer;
  };
  Object.defineProperty(crypto, 'subtle', { value: { digest }, configurable: true });
  console.warn(
    'Kickertool: Diese Seite läuft ohne sicheren Kontext (HTTP). Für die Anmeldung wird SHA-256 im Notbehelf berechnet ' +
      '(oidc.allowInsecureContext). Nur zum Testen im lokalen Netz verwenden.',
  );
  return true;
}
