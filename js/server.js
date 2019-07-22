const fs = require('fs')
const Module = require('module')
const { join } = require('path')

const ws = require('ws')

const wss = new ws.Server({ port: 3432 })
const aiFile = join(__dirname,'ai.js')
const evalAi = code => {
  const mod = new Module(aiFile, module.parent)
  mod._compile(code, aiFile)
  return mod.exports
}

const handle = async buffer => {
  const context = JSON.parse(buffer)
  let seed = Number(context.seed)
  context.rand = () => (2**32-1 & (seed = Math.imul(16807, seed))) / 2**32
  const { buildContext, ai } = evalAi(await fs.promises.readFile(aiFile, 'utf-8'))

  return { context: { ...context, ...buildContext(context) }, ai }
}

const logErr = fn => async arg => {
  try { await fn(arg) } catch (err) { console.log(err) }
}

wss.on('connection', logErr(async ws => {
  const { ai, context } = await new Promise((s, r) =>
    ws.once('message', buffer => s(handle(buffer))))

  const { name, count, index } = context
  ws.send(new TextEncoder().encode(name))
  ws.on('message', async buffer => {
    let i = -1
    const players = Array(count)
    while (++i < count) {
      const player = {x: buffer[i*2], y: buffer[i*2 + 1] }
      if (i == index) {
        players[0] = player
      } else if (i > index) {
        players[i] = player
      } else {
        players[i+1] = player
      }
    }

    try {
      ws.send(new Uint8Array([await ai(context, players)]))
    } catch (err) {
      console.log(err)
      ws.send(new Uint8Array([0xFF]))
    }
  })
}))
