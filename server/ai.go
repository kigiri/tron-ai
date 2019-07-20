const (
	NORTH = iota
	EAST   = iota
	SOUTH   = iota
	WEST = iota
)

const (
	UP          = iota
	RIGHT = iota
	DOWN = iota
	LEFT = iota
)

type State struct {

  //   color: A number that represent the color of a player
  //   name: A string of the player name
  //   score: A number of the total block collected by this player
  //   x: The horizontal position of the player
  //   y: The vertical position of the player
  //   coords: An array of 4 coordinates of the nearest blocks
  //     [ NORTH, EAST, SOUTH, WEST ]
  //                  N
  //               W  +  E
  //                  S
}

func ai() {

}
