/**
 * public/icon.svg から PWA 用の PNG を作る。
 *
 * アイコンを描き直したくなったら icon.svg を編集して `node scripts/generate-icons.mjs`。
 * 生成物もリポジトリに入れる。ビルド時に sharp を要求したくないため。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const source = await readFile(join(publicDir, 'icon.svg'));

// 192 と 512 は PWA のインストール要件。180 は iOS のホーム画面用
const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of sizes) {
  const png = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(join(publicDir, name), png);
  console.log(`${name} (${size}x${size}) ${png.length} bytes`);
}
