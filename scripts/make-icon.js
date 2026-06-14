const sharp = require('sharp')
const png2icons = require('png2icons')
const path = require('path')
const fs = require('fs')

const svgBuffer = Buffer.from(`<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="52" ry="52" fill="#0d2137"/>
  <rect x="60" y="108" width="44" height="88" rx="5" fill="rgba(255,255,255,0.92)"/>
  <rect x="114" y="136" width="36" height="60" rx="5" fill="rgba(255,255,255,0.6)"/>
  <rect x="160" y="120" width="44" height="76" rx="5" fill="#FF6B35"/>
  <line x1="48" y1="200" x2="212" y2="200" stroke="#FF6B35" stroke-width="6" stroke-linecap="round"/>
  <circle cx="82" cy="90" r="14" fill="#FF6B35"/>
  <circle cx="82" cy="90" r="22" fill="none" stroke="#FF6B35" stroke-width="2.5" opacity="0.35"/>
  <circle cx="82" cy="90" r="30" fill="none" stroke="#FF6B35" stroke-width="1.5" opacity="0.18"/>
</svg>`)

const outDir = path.join(__dirname, '../public')

async function run() {
  // Generate 256px PNG first
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer()
  fs.writeFileSync(path.join(outDir, 'icon.png'), png256)
  console.log('✓ public/icon.png')

  // Generate .ico (Windows) — contains 16/32/48/64/128/256
  const ico = png2icons.createICO(png256, png2icons.BICUBIC, 0, true)
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)
  console.log('✓ public/icon.ico')

  // Generate .icns (macOS)
  const icns = png2icons.createICNS(png256, png2icons.BICUBIC, 0)
  fs.writeFileSync(path.join(outDir, 'icon.icns'), icns)
  console.log('✓ public/icon.icns')
}

run().catch(console.error)
