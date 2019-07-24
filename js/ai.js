const [ NORTH, EAST, SOUTH, WEST ] = Array(4).keys()

// context.size: the size of the map (max 250)
// context.count: the amount of players in the game
// context.index: your personal index
// context.rand: a seeded random function
exports.buildContext = context => {

  // prepare you context here

  return {
    // we return a name, but you can add anything
  }
}


const wait = t => new Promise(s => setTimeout(s, t))
// context: contain everything you returned in buildContext
// players: the list of the players coordinate, you are the first in the list
exports.ai = async (context, players) => {
  // Return a direction here, choose wisely

  // always EAST, always right
  //await wait(Math.random()*1000)
  return EAST
}

exports.name = 'wesh'
