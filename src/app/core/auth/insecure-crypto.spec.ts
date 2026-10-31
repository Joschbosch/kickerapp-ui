import { installSha256Fallback, sha256 } from './insecure-crypto';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const text = (value: string) => new TextEncoder().encode(value);

describe('sha256', () => {
  // Testvektoren aus FIPS 180-4
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    [
      'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
    ],
  ])('berechnet den Hash von „%s“', (input, expected) => {
    expect(hex(sha256(text(input)))).toBe(expected);
  });

  it('berechnet den Hash einer Million „a“', () => {
    expect(hex(sha256(text('a'.repeat(1_000_000))))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('stimmt mit dem Browser überein, auch an den Blockgrenzen', async () => {
    if (!crypto.subtle) {
      return;
    }
    for (const length of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000]) {
      const data = new Uint8Array(length).map((_, index) => (index * 31 + length) & 0xff);
      const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
      expect(hex(sha256(data)), `Länge ${length}`).toBe(hex(expected));
    }
  });
});

describe('installSha256Fallback', () => {
  const original = Object.getOwnPropertyDescriptor(crypto, 'subtle');

  afterEach(() => {
    vi.restoreAllMocks();
    if (original) {
      Object.defineProperty(crypto, 'subtle', original);
    } else {
      Reflect.deleteProperty(crypto, 'subtle');
    }
  });

  /** So sieht ein unsicherer Kontext aus: `crypto.subtle` ist nicht vorhanden. */
  function withoutSubtle(): void {
    Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true });
  }

  it('lässt einen Browser mit eigenem `crypto.subtle` in Ruhe', () => {
    Object.defineProperty(crypto, 'subtle', { value: { vorhanden: true }, configurable: true });

    expect(installSha256Fallback()).toBe(false);
    expect((crypto.subtle as unknown as { vorhanden: boolean }).vorhanden).toBe(true);
  });

  it('baut ohne `crypto.subtle` ein SHA-256 ein, wie es die Anmeldung aufruft', async () => {
    withoutSubtle();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(installSha256Fallback()).toBe(true);
    const hashed = await crypto.subtle.digest('SHA-256', text('abc'));

    expect(hex(new Uint8Array(hashed))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashed).toBeInstanceOf(ArrayBuffer);
    expect(hashed.byteLength).toBe(32);
  });

  it('rechnet auch mit einem Ausschnitt eines größeren Puffers richtig', async () => {
    withoutSubtle();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installSha256Fallback();
    const bytes = text('xxabcxx');

    const hashed = await crypto.subtle.digest('SHA-256', bytes.subarray(2, 5));

    expect(hex(new Uint8Array(hashed))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('nimmt den Algorithmus auch als Objekt und lehnt andere Verfahren ab', async () => {
    withoutSubtle();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installSha256Fallback();

    expect((await crypto.subtle.digest({ name: 'sha-256' }, text('abc'))).byteLength).toBe(32);
    await expect(crypto.subtle.digest('SHA-1', text('abc'))).rejects.toThrow('Nur SHA-256');
  });

  it('weist in der Konsole darauf hin', () => {
    withoutSubtle();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    installSha256Fallback();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
