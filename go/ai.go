package main

import (
	"math/rand"
)

// the max size of a map
const max = 254
const (
	north = iota
	east
	south
	west
)

// The player strucure, only holds absolute coordinates (x, y)
// if x or y are greater than 254 (max) the player is dead or offline
type Player struct {
	x byte
	y byte
}

type Context struct {
	// The name of your AI
	Name  string

	// The size of a side of the map (always a square)
	Size int

	// The seed used for deterministic results, your AI must
	// return always the same output given the same seed and actions
	// this enable replayability of games
	Seed int

	// Your AI Index (not important)
	Index int

	// The number of AI
	Count int

	// A Seeded Random number generator (using Context.Seed)
	// -> read more at https://golang.org/pkg/math/rand/
	Rand rand.Rand
}

func (p Player) isDead() bool { return p.x >= max }

// buildContext is called when the game begins and is used
// to prepare the context.
// You have 5 seconds to prepare until your build timeout
// so try to do the expensive calculation here
func buildContext(ctx *Context) {
	(* ctx).Name = "jean-go"
}

// ai is called at each turns and must return one of the directions:
//      north
//    west east
//      south
// if you move to a non empty block you die.
func ai(ctx *Context, players []Player) byte {
	// always go down
	return south
}
