#!/usr/bin/env node
/**
 * Gera os ícones do app a partir do desenho oficial (Design/icone-app.svg, quadrado arredondado #2f3f34 com o símbolo).
 * O SVG original tem margem não quadrada (viewBox 1273×1229); aqui o recorte é o próprio quadrado arredondado.
 *
 *   src/app/icon.svg            favicon vetorial (cantos transparentes)
 *   src/app/favicon.ico         16, 32 e 48 px (PNG dentro do ICO)
 *   public/icons/icon-192.png   manifest, purpose "any" (cantos transparentes)
 *   public/icons/icon-512.png   idem; também é o logo das telas de abertura (scripts/splash.mjs)
 *   public/icons/maskable-512.png  fundo cheio, símbolo dentro da zona segura (círculo de 80%)
 *   public/icons/icon-180.png   apple-touch-icon: fundo cheio, sem transparência (o iOS arredonda sozinho)
 *
 *   node scripts/icons.mjs [caminho/do/icone.svg]    depois: node scripts/splash.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv[2] ?? join(root, '..', 'Design', 'icone-app.svg'))
const svg = readFileSync(source, 'utf8')

const rect = svg.match(/<rect\b[^>]*>/)[0]
const attr = (tag, name) => Number(tag.match(new RegExp(`\\b${name}="([\\d.]+)"`))[1])
const box = { x: attr(rect, 'x'), y: attr(rect, 'y'), size: attr(rect, 'width'), r: attr(rect, 'rx') }
const BG = rect.match(/fill="([^"]+)"/)[1]
const paths = svg.match(/<path\b[^>]*\/>/g).join('')

/** O símbolo num quadrado de lado `size`, ocupando `scale` do lado (1 = mesmo tamanho do desenho original). */
const compose = ({ size, scale = 1, rounded = false }) => {
  const s = (size / box.size) * scale
  const off = (size - box.size * s) / 2
  const back = rounded
    ? `<rect width="${size}" height="${size}" rx="${(box.r / box.size) * size}" fill="${BG}"/>`
    : `<rect width="${size}" height="${size}" fill="${BG}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${back}` +
    `<g transform="translate(${off} ${off}) scale(${s}) translate(${-box.x} ${-box.y})">${paths}</g></svg>`
}
const png = (markup) => sharp(Buffer.from(markup)).png({ compressionLevel: 9 }).toBuffer()

// Zona segura do maskable: o símbolo inteiro dentro do círculo de raio 40% do lado.
const probe = 1000
const alpha = await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${probe}" height="${probe}" viewBox="${box.x} ${box.y} ${box.size} ${box.size}">${paths}</svg>`,
)).ensureAlpha().extractChannel(3).raw().toBuffer()
let far = 0
for (let i = 0; i < alpha.length; i++) if (alpha[i] > 8) far = Math.max(far, Math.hypot(i % probe + 0.5 - probe / 2, Math.floor(i / probe) + 0.5 - probe / 2))
const maskScale = Math.min(1, (0.4 * probe) / far)
console.log(`símbolo vai até ${(far / probe * 100).toFixed(1)}% do centro; maskable em ${(maskScale * 100).toFixed(1)}%`)

writeFileSync(join(root, 'src', 'app', 'icon.svg'), compose({ size: 512, rounded: true }))
writeFileSync(join(root, 'public', 'icons', 'icon-192.png'), await png(compose({ size: 192, rounded: true })))
writeFileSync(join(root, 'public', 'icons', 'icon-512.png'), await png(compose({ size: 512, rounded: true })))
writeFileSync(join(root, 'public', 'icons', 'maskable-512.png'), await png(compose({ size: 512, scale: maskScale })))
const apple = await sharp(await png(compose({ size: 180 }))).flatten({ background: BG }).removeAlpha().png({ compressionLevel: 9 }).toBuffer()
writeFileSync(join(root, 'public', 'icons', 'icon-180.png'), apple)

// favicon.ico com PNGs dentro (aceito por todos os navegadores atuais).
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(size => png(compose({ size, rounded: true }))))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((size, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(size, e); header.writeUInt8(size, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3)
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(images[i].length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += images[i].length
})
writeFileSync(join(root, 'src', 'app', 'favicon.ico'), Buffer.concat([header, ...images]))
console.log('ícones gerados a partir de', source)
