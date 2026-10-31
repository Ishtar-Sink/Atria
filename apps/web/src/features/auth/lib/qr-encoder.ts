// Gerador de QR code mínimo (modo byte, correção M, versões 1 a 9, até 180 bytes), suficiente para a `otpauth_uri`.
// Existe porque o app não tem biblioteca de QR code e a ativação do 2FA precisa escaneá-lo.

interface VersionSpec {
  ec_per_block: number;
  blocks: [count: number, data_codewords: number][];
  alignment: number[];
}

const VERSIONS: Record<number, VersionSpec> = {
  1: { ec_per_block: 10, blocks: [[1, 16]], alignment: [] },
  2: { ec_per_block: 16, blocks: [[1, 28]], alignment: [6, 18] },
  3: { ec_per_block: 26, blocks: [[1, 44]], alignment: [6, 22] },
  4: { ec_per_block: 18, blocks: [[2, 32]], alignment: [6, 26] },
  5: { ec_per_block: 24, blocks: [[2, 43]], alignment: [6, 30] },
  6: { ec_per_block: 16, blocks: [[4, 27]], alignment: [6, 34] },
  7: { ec_per_block: 18, blocks: [[4, 31]], alignment: [6, 22, 38] },
  8: {
    ec_per_block: 22,
    blocks: [
      [2, 38],
      [2, 39],
    ],
    alignment: [6, 24, 42],
  },
  9: {
    ec_per_block: 22,
    blocks: [
      [3, 36],
      [2, 37],
    ],
    alignment: [6, 26, 46],
  },
};

const MASK_COUNT = 8;
// Bits do nível de correção M no campo de formato.
const EC_LEVEL_M_BITS = 0b00;

function dataCapacity(spec: VersionSpec): number {
  return spec.blocks.reduce((sum, [count, size]) => sum + count * size, 0);
}

function pickVersion(byte_length: number): number {
  for (const [version, spec] of Object.entries(VERSIONS)) {
    const header_bits = 4 + 8;
    if (Math.ceil((header_bits + byte_length * 8) / 8) <= dataCapacity(spec)) {
      return Number(version);
    }
  }
  throw new RangeError('qr_payload_too_long');
}

// Aritmética do corpo de Galois GF(256) com o polinômio 0x11D.
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
(() => {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255] ?? 0;
})();

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

function reedSolomon(data: number[], ec_count: number): number[] {
  let generator = [1];
  for (let i = 0; i < ec_count; i += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] = (next[index] ?? 0) ^ gfMultiply(coefficient, EXP[i] ?? 0);
      next[index + 1] = (next[index + 1] ?? 0) ^ coefficient;
    });
    generator = next;
  }
  // `generator` está em ordem crescente de grau; a divisão usa a ordem decrescente.
  const divisor = generator.slice().reverse().slice(1);
  const remainder = new Array<number>(ec_count).fill(0);
  for (const byte of data) {
    const factor = byte ^ (remainder.shift() ?? 0);
    remainder.push(0);
    divisor.forEach((coefficient, index) => {
      remainder[index] = (remainder[index] ?? 0) ^ gfMultiply(coefficient, factor);
    });
  }
  return remainder;
}

function buildCodewords(bytes: number[], version: number): number[] {
  const spec = VERSIONS[version] as VersionSpec;
  const capacity = dataCapacity(spec);
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((byte) => {
    push(byte, 8);
  });
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0; data.length < capacity; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (const [count, size] of spec.blocks) {
    for (let i = 0; i < count; i += 1) {
      const chunk = data.slice(offset, offset + size);
      offset += size;
      blocks.push({ data: chunk, ec: reedSolomon(chunk, spec.ec_per_block) });
    }
  }
  const out: number[] = [];
  const longest = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < longest; i += 1) {
    blocks.forEach((block) => {
      const byte = block.data[i];
      if (byte !== undefined) out.push(byte);
    });
  }
  for (let i = 0; i < spec.ec_per_block; i += 1) {
    blocks.forEach((block) => out.push(block.ec[i] ?? 0));
  }
  return out;
}

function bchRemainder(value: number, generator: number, degree: number): number {
  let result = value << degree;
  const generator_length = generator.toString(2).length;
  while (result.toString(2).length >= generator_length) {
    result ^= generator << (result.toString(2).length - generator_length);
  }
  return result;
}

interface Grid {
  size: number;
  modules: boolean[][];
  reserved: boolean[][];
}

function createGrid(version: number): Grid {
  const size = 17 + 4 * version;
  const make = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules: make(), reserved: make() };
}

function setFunction(grid: Grid, row: number, col: number, dark: boolean) {
  if (row < 0 || col < 0 || row >= grid.size || col >= grid.size) return;
  (grid.modules[row] as boolean[])[col] = dark;
  (grid.reserved[row] as boolean[])[col] = true;
}

function drawFinder(grid: Grid, row: number, col: number) {
  for (let dr = -1; dr <= 7; dr += 1) {
    for (let dc = -1; dc <= 7; dc += 1) {
      const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      setFunction(grid, row + dr, col + dc, ring !== 2 && ring !== 4);
    }
  }
}

function drawAlignment(grid: Grid, center_row: number, center_col: number) {
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      setFunction(grid, center_row + dr, center_col + dc, ring !== 1);
    }
  }
}

function drawFunctionPatterns(grid: Grid, version: number) {
  const { size } = grid;
  for (let i = 0; i < size; i += 1) {
    setFunction(grid, 6, i, i % 2 === 0);
    setFunction(grid, i, 6, i % 2 === 0);
  }
  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, size - 7);
  drawFinder(grid, size - 7, 0);
  const positions = (VERSIONS[version] as VersionSpec).alignment;
  const last = positions.length - 1;
  positions.forEach((row, i) => {
    positions.forEach((col, j) => {
      const on_finder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!on_finder) drawAlignment(grid, row, col);
    });
  });
  setFunction(grid, size - 8, 8, true);
  drawFormat(grid, 0);
  if (version >= 7) drawVersion(grid, version);
}

function drawFormat(grid: Grid, mask: number) {
  const data = (EC_LEVEL_M_BITS << 3) | mask;
  const bits = ((data << 10) | bchRemainder(data, 0x537, 10)) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const { size } = grid;
  for (let i = 0; i <= 5; i += 1) setFunction(grid, i, 8, bit(i));
  setFunction(grid, 7, 8, bit(6));
  setFunction(grid, 8, 8, bit(7));
  setFunction(grid, 8, 7, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(grid, 8, 14 - i, bit(i));
  for (let i = 0; i < 8; i += 1) setFunction(grid, 8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(grid, size - 15 + i, 8, bit(i));
}

function drawVersion(grid: Grid, version: number) {
  const bits = (version << 12) | bchRemainder(version, 0x1f25, 12);
  const { size } = grid;
  for (let i = 0; i < 18; i += 1) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(grid, b, a, dark);
    setFunction(grid, a, b, dark);
  }
}

function placeData(grid: Grid, codewords: number[]) {
  const { size } = grid;
  const total_bits = codewords.length * 8;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    const column = right === 6 ? 5 : right;
    const upward = ((column + 1) & 2) === 0;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [column, column - 1]) {
        if ((grid.reserved[row] as boolean[])[col]) continue;
        const byte = codewords[index >>> 3] ?? 0;
        const dark = index < total_bits && ((byte >>> (7 - (index & 7))) & 1) === 1;
        (grid.modules[row] as boolean[])[col] = dark;
        index += 1;
      }
    }
  }
}

function maskApplies(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function applyMask(grid: Grid, mask: number): boolean[][] {
  return grid.modules.map((line, row) =>
    line.map((dark, col) =>
      grid.reserved[row]?.[col] ? dark : dark !== maskApplies(mask, row, col),
    ),
  );
}

function runPenalty(line: boolean[]): number {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i += 1) {
    if (i < line.length && line[i] === line[i - 1]) {
      run += 1;
      continue;
    }
    if (run >= 5) penalty += run - 2;
    run = 1;
  }
  return penalty;
}

function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;
  for (let i = 0; i < size; i += 1) {
    score += runPenalty(modules[i] as boolean[]);
    score += runPenalty(modules.map((line) => line[i] as boolean));
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const dark = modules[row]?.[col];
      if (
        dark === modules[row]?.[col + 1] &&
        dark === modules[row + 1]?.[col] &&
        dark === modules[row + 1]?.[col + 1]
      ) {
        score += 3;
      }
    }
  }
  const dark_count = modules.flat().filter(Boolean).length;
  const percent = (dark_count * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/** Devolve a matriz do QR code (`true` é módulo escuro) para o texto informado. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = pickVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const grid = createGrid(version);
  drawFunctionPatterns(grid, version);
  placeData(grid, codewords);

  let best_mask = 0;
  let best_score = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < MASK_COUNT; mask += 1) {
    const score = penalty(applyMask(grid, mask));
    if (score < best_score) {
      best_score = score;
      best_mask = mask;
    }
  }
  const final = createGrid(version);
  drawFunctionPatterns(final, version);
  placeData(final, codewords);
  drawFormat(final, best_mask);
  return applyMask(final, best_mask);
}
