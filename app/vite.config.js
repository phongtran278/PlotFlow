import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function normalizeBadgeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function macGoldBadgeFallback() {
  return {
    name: 'plotflow-macos-gold-badge-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = String(req.url || '').split('?')[0]
        if (!rawUrl.startsWith('/assets/badges/')) return next()

        let requestedName = ''
        try {
          requestedName = decodeURIComponent(rawUrl.slice('/assets/badges/'.length))
        } catch {
          return next()
        }

        const normalized = normalizeBadgeName(requestedName)
        const match = normalized.match(/^([13569]) chi\.png$/)
        if (!match) return next()

        const badgeDir = path.join(__dirname, 'public', 'assets', 'badges')
        if (!fs.existsSync(badgeDir)) return next()

        const amount = match[1]
        const actualName = fs.readdirSync(badgeDir).find((name) => normalizeBadgeName(name) === `${amount} chi.png`)
        if (!actualName) return next()

        try {
          const filePath = path.join(badgeDir, actualName)
          res.statusCode = 200
          res.setHeader('Content-Type', 'image/png')
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(filePath).pipe(res)
        } catch {
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [macGoldBadgeFallback(), react()],
})
