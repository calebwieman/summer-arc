import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BG = "#0a0a0a";
const FG = "#f59e0b";

function svg(size) {
  const fontSize = Math.round(size * 0.66);
  const cy = Math.round(size * 0.5 + fontSize * 0.36);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="50%" y="${cy}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-weight="700" font-size="${fontSize}" fill="${FG}" text-anchor="middle">S</text>
</svg>`;
}

await mkdir(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const buf = await sharp(Buffer.from(svg(size)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  const file = join(publicDir, `icon-${size}.png`);
  await writeFile(file, buf);
  console.log(`Wrote ${file} (${buf.length} bytes)`);
}
