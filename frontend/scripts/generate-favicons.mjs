/**
 * Generate static favicon PNG files from SVG source.
 * Run: node scripts/generate-favicons.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// SmartHire "S" favicon — indigo gradient rounded square with white S and accent dot
function createFaviconSvg(size) {
  const r = Math.round(size * 0.1875) // border-radius ~22%
  const dotR = Math.round(size * 0.035)
  const dotCx = Math.round(size * 0.76)
  const dotCy = Math.round(size * 0.225)

  // S path control points scaled to size
  const s = (v) => Math.round((v / 512) * size)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g)" width="${size}" height="${size}" rx="${r}"/>
  <path d="M ${s(330)} ${s(150)} C ${s(330)} ${s(95)}, ${s(180)} ${s(95)}, ${s(180)} ${s(165)} C ${s(180)} ${s(230)}, ${s(330)} ${s(275)}, ${s(330)} ${s(340)} C ${s(330)} ${s(405)}, ${s(180)} ${s(405)}, ${s(180)} ${s(360)}"
    stroke="white" stroke-width="${Math.max(Math.round(size * 0.097), 2)}" stroke-linecap="round" fill="none"/>
  ${size >= 64 ? `<circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="rgba(255,255,255,0.35)"/>` : ''}
</svg>`
}

const targets = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-192x192.png', size: 192 },
  { name: 'favicon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

async function main() {
  const outDir = join(ROOT, 'public')
  mkdirSync(outDir, { recursive: true })

  for (const { name, size } of targets) {
    const svg = createFaviconSvg(size)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    const outPath = join(outDir, name)
    writeFileSync(outPath, png)
    console.log(`  ✓ ${name} (${size}x${size})`)
  }

  // Also generate favicon.ico (32x32 PNG wrapped — browsers accept PNG-based .ico)
  const icoSvg = createFaviconSvg(32)
  const icoPng = await sharp(Buffer.from(icoSvg)).png().toBuffer()
  writeFileSync(join(outDir, 'favicon.ico'), icoPng)
  console.log('  ✓ favicon.ico (32x32)')

  console.log('\nAll favicons generated in public/')
}

main().catch(console.error)
