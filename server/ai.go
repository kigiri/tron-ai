package main

import (
	"fmt"
	"math/rand"
)

const MAX = 0xff - 2
const (
	NORTH = iota
	EAST  = iota
	SOUTH = iota
	WEST  = iota
)

const (
	UP    = iota
	RIGHT = iota
	DOWN  = iota
	LEFT  = iota
)

type Player struct {
	x byte
	y byte
}

type Context struct {
	Seed  int
	Index int
	Count int
	Rand  rand.Rand
}

func (p Player) isDead() bool { return p.x >= MAX }

func ai(players []Player, ctx *Context) byte {
	fmt.Println(players[0])
	// always go down
	if ctx.Index%2 == 0 {
		return SOUTH
	}
	return NORTH
}
