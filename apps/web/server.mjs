import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const API_HOST = process.env.API_HOST || 'api'
const API_PORT = Number(process.env.API_PORT || 3000)
const PORT = Number(process.env.PORT || 80)
const PROXY_TIMEOUT_MS = 120_000

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendFile(res, filePath) {
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

function proxyApi(req, res) {
  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` }
  delete headers.connection
  const upstream = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers,
      timeout: PROXY_TIMEOUT_MS,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('timeout', () => {
    upstream.destroy()
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('API timeout')
    }
  })
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('API unavailable')
    } else {
      res.destroy()
    }
  })
  req.pipe(upstream)
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0] || '/')
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    proxyApi(req, res)
    return
  }

  const relative = urlPath === '/' ? '/index.html' : urlPath
  const filePath = path.normalize(path.join(DIST, relative))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }
  sendFile(res, path.join(DIST, 'index.html'))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`web http://0.0.0.0:${PORT} -> ${API_HOST}:${API_PORT}`)
})
