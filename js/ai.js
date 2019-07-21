const [ NORTH, EAST, SOUTH, WEST ] = Array(4).keys()

// context.size: the size of the map (max 254)
// context.count: the amount of players in the game
// context.index: your personal index
// context.seed: the seed used for this game
// context.rand: a random object allowing you to get random numbers form the seed
// context.color: your color, not very important
exports.buildContext = context => {

  // prepare you context here

  return {
    // we return a name, but you can add anything
    name: 'jean-js',
  }
}

// context: contain everything you returned in buildContext
// players: the list of the players coordinate, you are the first in the list
exports.ai = (context, players) => {
  // Return a direction here, choose wisely

  // always EAST, always right
  return EAST
}
