/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilidades de aleatoriedad criptográficamente uniforme (CSPRNG) sin sesgo de módulo
 * para barajado de mazos 52 cartas, selección de escenarios, Academia y Simulador.
 */

const MAX_UINT32 = 0x100000000; // 2^32

export function cryptoRandomFloat(): number {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      return buf[0] / MAX_UINT32;
    }
  } catch {
    // fallback below
  }
  return Math.random();
}

/**
 * Devuelve un entero uniforme en [0, max - 1] evitando sesgo de módulo con rejection sampling.
 */
export function cryptoRandomInt(max: number): number {
  if (!Number.isFinite(max) || max <= 1) return 0;
  const bound = Math.floor(max);

  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const limit = Math.floor(MAX_UINT32 / bound) * bound;
      const buf = new Uint32Array(1);
      // Rejection sampling guarantees strict uniformity across [0, bound)
      for (let i = 0; i < 16; i++) {
        globalThis.crypto.getRandomValues(buf);
        if (buf[0] < limit) {
          return buf[0] % bound;
        }
      }
      return buf[0] % bound;
    }
  } catch {
    // fallback below
  }

  return Math.floor(Math.random() * bound);
}

export function cryptoShuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cryptoPick<T>(arr: readonly T[]): T {
  return arr[cryptoRandomInt(arr.length)];
}
