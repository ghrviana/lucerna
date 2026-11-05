// Gera os PNGs da extensao a partir de assets/icon/lucerna.svg e lucerna-small.svg.
// Uso: node scripts/icons.mjs (ou npm run icons)
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const MAIN = readFileSync('assets/icon/lucerna.svg');
const SMALL = readFileSync('assets/icon/lucerna-small.svg');

// 16 e 32 usam a versao simplificada (sem alca, formas grossas); 48/96/128 usam a versao principal.
const SIZES = [
  [16, SMALL],
  [32, SMALL],
  [48, MAIN],
  [96, MAIN],
  [128, MAIN],
];

mkdirSync('public/icon', { recursive: true });
for (const [size, svg] of SIZES) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon/${size}.png`);
}
console.log('Icones gerados em public/icon');
