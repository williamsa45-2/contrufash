#!/usr/bin/env node
/**
 * Genera los iconos PWA (192x192 y 512x512) en /public/img/.
 * Se corre una sola vez: node scripts/generar-iconos.js
 * Requiere sharp (ya instalado como dependencia del proyecto).
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '../public/img');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// SVG del icono: fondo asfalto + "CF" en naranja
function svgIcon(size) {
  const fs2 = Math.round(size * 0.38);
  const cy  = Math.round(size * 0.56);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size*0.18)}" fill="#1c1f23"/>
  <rect width="${size}" height="${Math.round(size*0.08)}" y="${Math.round(size*0.92)}" rx="0" fill="#e8590c"/>
  <text x="50%" y="${cy}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Narrow, sans-serif" font-weight="bold" font-size="${fs2}"
    fill="#e8590c">CF</text>
</svg>`);
}

async function generar() {
  for (const size of [192, 512]) {
    const dest = path.join(OUT, `icon-${size}.png`);
    await sharp(svgIcon(size))
      .png()
      .toFile(dest);
    console.log(`[icons] Generado: ${dest}`);
  }
  console.log('[icons] Listo.');
}

generar().catch(console.error);
