// High-performance streaming FIPS 180-4 SHA-256 implementation
// Zero dependencies, works seamlessly in main thread and Web Workers

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export class StreamingSHA256 {
  private h = new Uint32Array(8);
  private block = new Uint8Array(64);
  private blockLen = 0;
  private totalBytesLow = 0;
  private totalBytesHigh = 0;
  private w = new Uint32Array(64);

  constructor() {
    this.init();
  }

  public init(): void {
    this.h[0] = 0x6a09e667;
    this.h[1] = 0xbb67ae85;
    this.h[2] = 0x3c6ef372;
    this.h[3] = 0xa54ff53a;
    this.h[4] = 0x510e527f;
    this.h[5] = 0x9b05688c;
    this.h[6] = 0x1f83d9ab;
    this.h[7] = 0x5be0cd19;
    this.blockLen = 0;
    this.totalBytesLow = 0;
    this.totalBytesHigh = 0;
  }

  public update(data: Uint8Array): void {
    const len = data.length;
    let offset = 0;

    // Update total bytes (64-bit uint)
    this.totalBytesLow += len;
    if (this.totalBytesLow >= 0x100000000) {
      this.totalBytesHigh += Math.floor(this.totalBytesLow / 0x100000000);
      this.totalBytesLow = this.totalBytesLow >>> 0;
    }

    if (this.blockLen > 0) {
      const needed = 64 - this.blockLen;
      if (len >= needed) {
        this.block.set(data.subarray(0, needed), this.blockLen);
        this.processBlock(this.block, 0);
        this.blockLen = 0;
        offset = needed;
      } else {
        this.block.set(data, this.blockLen);
        this.blockLen += len;
        return;
      }
    }

    while (offset + 64 <= len) {
      this.processBlock(data, offset);
      offset += 64;
    }

    const remaining = len - offset;
    if (remaining > 0) {
      this.block.set(data.subarray(offset, len), 0);
      this.blockLen = remaining;
    }
  }

  public digest(): string {
    // Total bits = totalBytes * 8
    const totalBitsLow = (this.totalBytesLow << 3) >>> 0;
    const totalBitsHigh = ((this.totalBytesHigh << 3) | (this.totalBytesLow >>> 29)) >>> 0;

    // Append 0x80
    this.block[this.blockLen++] = 0x80;

    if (this.blockLen > 56) {
      while (this.blockLen < 64) {
        this.block[this.blockLen++] = 0;
      }
      this.processBlock(this.block, 0);
      this.blockLen = 0;
    }

    while (this.blockLen < 56) {
      this.block[this.blockLen++] = 0;
    }

    // Append 64-bit bit length in big-endian
    const view = new DataView(this.block.buffer, this.block.byteOffset, 64);
    view.setUint32(56, totalBitsHigh, false);
    view.setUint32(60, totalBitsLow, false);

    this.processBlock(this.block, 0);

    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += this.h[i]!.toString(16).padStart(8, '0');
    }
    return hex;
  }

  private processBlock(buf: Uint8Array, offset: number): void {
    const w = this.w;
    const view = new DataView(buf.buffer, buf.byteOffset + offset, 64);

    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4, false);
    }

    for (let i = 16; i < 64; i++) {
      const s0 =
        (((w[i - 15]! >>> 7) | (w[i - 15]! << 25)) ^
          ((w[i - 15]! >>> 18) | (w[i - 15]! << 14)) ^
          (w[i - 15]! >>> 3)) >>>
        0;
      const s1 =
        (((w[i - 2]! >>> 17) | (w[i - 2]! << 15)) ^
          ((w[i - 2]! >>> 19) | (w[i - 2]! << 13)) ^
          (w[i - 2]! >>> 10)) >>>
        0;
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = this.h[0]!;
    let b = this.h[1]!;
    let c = this.h[2]!;
    let d = this.h[3]!;
    let e = this.h[4]!;
    let f = this.h[5]!;
    let g = this.h[6]!;
    let h = this.h[7]!;

    for (let i = 0; i < 64; i++) {
      const s1 =
        (((e >>> 6) | (e << 26)) ^
          ((e >>> 11) | (e << 21)) ^
          ((e >>> 25) | (e << 7))) >>>
        0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 =
        (((a >>> 2) | (a << 30)) ^
          ((a >>> 13) | (a << 19)) ^
          ((a >>> 22) | (a << 10))) >>>
        0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.h[0] = (this.h[0]! + a) >>> 0;
    this.h[1] = (this.h[1]! + b) >>> 0;
    this.h[2] = (this.h[2]! + c) >>> 0;
    this.h[3] = (this.h[3]! + d) >>> 0;
    this.h[4] = (this.h[4]! + e) >>> 0;
    this.h[5] = (this.h[5]! + f) >>> 0;
    this.h[6] = (this.h[6]! + g) >>> 0;
    this.h[7] = (this.h[7]! + h) >>> 0;
  }
}
