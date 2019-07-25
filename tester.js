const fs = require('fs')
const net = require('net')
const http = require('http')

const SOCKETS = new Map()
const [ START, MOVES ] = Array(0xFF).keys()
const [ NORTH, EAST, SOUTH, WEST ] = Array(0xFF).keys()
const PI2 = Math.PI * 2

let aiList = '[]'
const updateAiList = () =>
  aiList = Buffer.from(JSON.stringify([...SOCKETS.keys()]))

const getSocket = name => SOCKETS.get(name)
function remove() {
  SOCKETS.delete(this.name)
  updateAiList()
}

const toInt = (r, g, b) => (r << 16) | (g << 8) | b
const toRange = n => Math.round(n * 0xFF)
const hue2rgb = (p, q, t) => {
  if(t < 0) t += 1
  if(t > 1) t -= 1
  if(t < 1/6) return p + (q - p) * 6 * t
  if(t < 1/2) return q
  if(t < 2/3) return p + (q - p) * (2/3 - t) * 6
  return p
}

const hslToRgb = (h, s, l) => {
  if (!s) return toInt(toRange(l), toRange(l), toRange(l))

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1/3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1/3)

  return toInt(toRange(r), toRange(g), toRange(b))
}

const take = ({ games, queue }, register) => {
  let i = -1
  while (++i <= 0xFF) {
    if (!games.has(i)) return games.set(i, register(i))
  }
  queue.push(register)
}

const free = ({ games, queue }, id) => {
  const register = queue.pop()
  if (register) return games.set(id, register(id))
  games.delete(id)
}

function handleData(buff) {
  const { games } = this
  let i = -1
  while (++i < buff.length) {
    const id = i
    const game = games.get(buff[id])
    const action = buff[++i]
    game && game(action)
  }
}

const logErrOrMessage = m => err => err ? console.log(err) : console.log(m)
net.createServer(socket => socket.once('data', buff => {
  socket.name = buff.toString('utf8').replace(/[^-_.a-z0-9]/ig, '-')
  socket.games = new Map()
  socket.queue = []
  SOCKETS.set(socket.name, socket)
  updateAiList()
  socket.on('error', console.log)
  socket.on('close', remove)
  socket.on('data', handleData)
  socket.setTimeout(0)
  socket.setKeepAlive(false)
}))
  .on('error', console.log)
  .listen(3234, logErrOrMessage('net open'))

const fail = (code, res, message) => {
  res.status = code
  res.end(`${http.STATUS_CODES[code]} (${message})`)
}

const seedRand = s =>
  () => Math.abs((2**32-1 & (s = Math.imul(16807, s))) / 2**32)

const shuffle = (arr, rand) => {
  let i = arr.length
  let j, tmp
  while (--i > 0) {
    j = Math.floor(rand() * (i + 1))
    tmp = arr[j]
    arr[j] = arr[i]
    arr[i] = tmp
  }
  return arr
}

const movesLeft = (state, size, i) => {
  const y = i % size
  const x = (i - y) / size
  return 4
    - (inBound(x - 1) && state[i - size])
    + (inBound(y + 1) && state[i + 1])
    + (inBound(x + 1) && state[i + size])
    + (inBound(y - 1) && state[i - 1])
}

const copyMoves = (state, size, count, moves) => {
  let i = -1
  while (++i < count) {
    state[moves[i*2]*size+moves[i*2+1]] = i + 1
  }
}

const formatAi = p => ({ name: p.socket.name, color: p.color, x: p.x, y: p.y })
const max = (m, n) => n > m ? max(1, n - m) : n
const inBound = (n, size) => n >= 0 && n < size
const makePlayer = (socket, index) => ({ socket, index })
const startGame = async (res, params) => {
  const size = Math.min(Math.max(Number(params.get('size')), 8), 250) || 128
  const seed = Math.abs(Number(params.get('seed'))
    || Math.floor(Math.random()*0XFFFFFF))


  const sockets = (params.get('ai')||'')
    .split(' ')
    .sort()
    .map(getSocket)
    .filter(Boolean)

  if (!sockets.length) return fail(400, res, 'missing ai url parameter')
  // state
  let deads = 0
  let current = 0
  const rand = seedRand(seed)
  const count = sockets.length
  const rate = size / count / size
  const angle = PI2 / count
  const shift = angle * rand()
  const h = size / 2
  const m = h * 0.8
  const state = new Uint8Array(size*size)
  const moves = Buffer.from(sockets.flatMap((_, i) => [
    Math.round(max(PI2, Math.cos(angle * i + shift)) * m + h),
    Math.round(max(PI2, Math.sin(angle * i + shift)) * m + h),
  ]))

  copyMoves(state, size, count, moves)

  const players = shuffle(sockets, rand).map((socket, index) => ({
    index,
    socket,
    color: hslToRgb(max(1, index * rate + 0.25), 1, 0.5),
    X: index * 2,
    Y: index * 2 + 1,
  }))

  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Type', 'application/octet-stream')
  res.write(Buffer.from([
    ...Buffer.from(`${JSON.stringify({ size, seed, ai: players.map(formatAi) })}\n`),
    ...moves,
  ]))

  const startData = [ count, size, seed, seed >> 8, seed >> 16 ]
  players.forEach(player => take(player.socket, id => {
    const { index, socket, color, X, Y } = player
    player.id = id
    socket.write(Buffer.from([ START, id, ...startData, index,...moves ]))

    return move => {
      let x = moves[X]
      let y = moves[Y]
      switch (move) {
        case SOUTH: ++y; break
        case EAST:  ++x; break
        case NORTH: --y; break
        case WEST:  --x; break
      }

      const i = player.i = x * size + y
      if (!state[i] && inBound(y, size) && inBound(x, size)) {
        current++
        moves[X] = x
        moves[Y] = y
        state[i] = 1
      } else {
        free(socket, id)
        player.isDead = true
        moves[X] = 0xFF
        moves[Y] = 0xFF
        deads++
      }

      if (current + deads < count) return
      current = 0
      if (deads === count) return res.end(moves)
      // after all the socket answerd, trigger next move
      res.write(moves)
      for (const p of players) {
        if (!p.isDead && !p.socket.destroyed && movesLeft(state, size, p.i)) {
          p.socket.write(Buffer.from([MOVES, p.id, ...moves]))
        }
      }
    }
  }))

  res.on('close', () => {
    // connection closed, cleaning up everything
    for (const { isDead, socket, id, update } of players) {
      if (id === undefined || isDead || socket.destroyed) continue
      free(socket, id)
    }
  })
}

const indexFile = fs.readFileSync('./index.html')
const handleHttp = (req, res) => {
  const { searchParams, pathname } = new URL(`http://n${req.url}`)
  switch (pathname) {
    case '/': {
      // we should add brotli / gzip
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(indexFile)
    }
    case '/start':
    case '/start/': return startGame(res, searchParams)
    case '/ai':
    case '/ai/': {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.end(aiList)
    }
    // case '/history': // should send a list of latest games ?
  }
  fail(404, res, pathname)
}

const port = Number(process.env.PORT) || 3432
if (port === 443) {
  require('https').createServer({
    cert: fs.readFileSync('./oct.ovh.cert'),
    key: fs.readFileSync('./oct.ovh.key'),
  }, handleHttp).listen(port, logErrOrMessage('https open'))
} else {
  http.createServer(handleHttp).listen(port, logErrOrMessage('http open'))
}

