#!/usr/bin/env node
/**
 * Gera as telas de abertura do iPhone (apple-touch-startup-image) em public/splash/: o ícone do app no centro, sobre o
 * fundo do app (#E2E1E0). O iOS só usa a imagem quando o tamanho bate com o aparelho, por isso uma por tela.
 * A lista é a mesma de src/lib/splash.ts.
 *
 *   node scripts/splash.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { SPLASH } from '../src/lib/splash.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'splash')
mkdirSync(out, { recursive: true })

for (const { w, h, dpr } of SPLASH) {
  const width = w * dpr, height = h * dpr
  const icon = Math.round(width * 0.32)
  const logo = await sharp(join(root, 'public', 'icons', 'icon-512.png')).resize(icon, icon).png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background: '#E2E1E0' } })
    .composite([{ input: logo, left: Math.round((width - icon) / 2), top: Math.round((height - icon) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(join(out, `splash-${width}x${height}.png`))
  console.log(`splash-${width}x${height}.png`)
}
