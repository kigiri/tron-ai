const { createConnection } = require('net')
const fs = require('fs')
const Module = require('module')
const { join } = require('path')

const aiFile = join(__dirname,'ai.js')
const evalAi = async filename => {
  const code = await fs.promises.readFile(filename, 'utf-8')
  const mod = new Module(filename, module.parent)
  mod._compile(code, filename)
  return mod.exports
}

const handle = async buff => {
  let seed = (buff[2] + (buff[3] << 8) + (buff[4] << 16))
  const { buildContext, ai } = await evalAi(aiFile)
  const context = {
    count: buff[0],
    size: buff[1],
    index: buff[5],
    rand: () => Math.abs((2**32-1 & (seed = Math.imul(16807, seed))) / 2**32),
  }

  return { context: { ...buildContext(context), ...context }, ai }
}

const pending = []
const games = [...Array(0xFF).keys()].map(id => ({ id }))
const handleInit = async (game, buff) => {
  const { context, ai } = await handle(buff)
  const { count, index } = context
  const { id } = game
  game.size = count * 2
  game.run = async moves => {
    let i = -1
    const players = Array(count)
    while (++i < count) {
      const player = { x: moves[i*2], y: moves[i*2 + 1] }
      if (i == index) {
        players[0] = player
      } else if (i > index) {
        players[i] = player
      } else {
        players[i+1] = player
      }
    }
    return Buffer.from([id, await ai(context, players)])
  }
  return game.run(buff.slice(6))
}

const connect = () => createConnection(3234, 'localhost', async function() {
  const socket = this
  console.log('connected to remote server')
  const write = data => socket.write(data)
  write((await evalAi(aiFile)).name || 'anon')
  socket.on('data', buff => {
    let i = 0
    while (i < buff.length) {
      const action = buff[i++]
      const game = games[buff[i++]]
      try {
        switch (action) {
          case 0x00: {
            const end = buff[i]*2 + 6 + i
            handleInit(game, buff.slice(i, end)).then(write)
            i = end
            break
          }
          case 0x01: {
            game.run && game.run(buff.slice(i, i + game.size)).then(write)
            i += game.size
            break
          }
        }
      } catch (err) {
        console.log(err)
        console.log('while parsing', buff)
        process.exit(1)
      }
    }
  })
})
  .on('error', err => console.log('connection error', err.message))
  .on('close', () => setTimeout(connect, 1000))

connect()
