import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BG = "#0b0b0d";
const INK = "#f4f4f5";

/**
 * The mark is the app's own idea: a vertical spine crossed by the now-line.
 * The spine is solid above the crossing (elapsed) and faint below (remaining),
 * with a raised index node where the two meet. Monochrome, no letterform, and
 * it still reads as a distinct silhouette at 16px.
 *
 * All artwork sits inside the central ~64% so it survives a maskable crop.
 */
function svg(size, { plate = true } = {}) {
  const s = size;
  // The spine sits left of centre and the now-line runs across the content to
  // its right — the same geometry as the screen itself, and it keeps the mark
  // from reading as a crucifix the way a centred crossbar does.
  const cx = s * 0.35;
  const cy = s * 0.44;

  const spineW = s * 0.075;
  const barH = s * 0.075;
  const barX = s * 0.19;
  const barW = s * 0.63;

  const top = s * 0.15;
  const bottom = s * 0.85;
  const r = spineW / 2;

  // Graduations march down the remaining stem — a scale, not decoration.
  const tick = (y, w) =>
    `<rect x="${cx - spineW / 2 - s * 0.030 - w}" y="${y - s * 0.011}" width="${w}" height="${s * 0.022}" fill="${INK}" opacity="0.5" rx="${s * 0.011}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${plate ? `<rect width="${s}" height="${s}" fill="${BG}"/>` : ""}
  <!-- stem below the crossing: what is still ahead -->
  <rect x="${cx - spineW / 2}" y="${cy}" width="${spineW}" height="${bottom - cy}" fill="${INK}" opacity="0.32" rx="${r}"/>
  ${tick(s * 0.58, s * 0.075)}
  ${tick(s * 0.68, s * 0.048)}
  ${tick(s * 0.78, s * 0.075)}
  <!-- stem above the crossing: what is already behind -->
  <rect x="${cx - spineW / 2}" y="${top}" width="${spineW}" height="${cy - top}" fill="${INK}" rx="${r}"/>
  <!-- the now-line -->
  <rect x="${barX}" y="${cy - barH / 2}" width="${barW}" height="${barH}" fill="${INK}" rx="${barH / 2}"/>
</svg>`;
}

await mkdir(publicDir, { recursive: true });

for (const size of [192, 512, 180, 32]) {
  const buf = await sharp(Buffer.from(svg(size)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  const name =
    size === 180 ? "apple-touch-icon.png" : size === 32 ? "favicon-32.png" : `icon-${size}.png`;
  await writeFile(join(publicDir, name), buf);
  console.log(`Wrote ${name} (${buf.length} bytes)`);
}

// Crisp vector favicon for browsers that take one.
await writeFile(join(publicDir, "favicon.svg"), svg(64));
console.log("Wrote favicon.svg");
