package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{} // use default options
var port = flag.String("port", "3432", "http service port")

func serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("error upgrading:", err)
		return
	}
	defer c.Close()

	// read first message
	_, message, err := c.ReadMessage()
	ctx := Context{}
	json.Unmarshal(message, &ctx)
	log.Println("starting game:", ctx)
	index := ctx.Index
	count := ctx.Count

	// Build the context
	buildContext(&ctx)

	// signal that we are read and send player name
	err = c.WriteMessage(websocket.BinaryMessage, []byte(ctx.Name))
	if err != nil {
		log.Println(err)
		return
	}

	// Loop until the game is over
	for {
		_, buffer, err := c.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		players := make([]Player, count)
		for i := 0; i < count; i++ {
			x := i * 2
			y := x + 1
			if i == index {
				players[0].x = buffer[x]
				players[0].y = buffer[y]
			} else if i > index {
				players[i].x = buffer[x]
				players[i].y = buffer[y]
			} else {
				players[i+1].x = buffer[x]
				players[i+1].y = buffer[y]
			}
		}
		c.WriteMessage(websocket.BinaryMessage, []byte{ai(&ctx, players)})
	}
}

func main() {
	flag.Parse()
	log.SetFlags(0)
	http.HandleFunc("/", serveWs)
	log.Println("server go listening on port " + *port)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}
