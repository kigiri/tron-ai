package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

const NAME = "kigiri"

var port = flag.String("port", "8751", "http service port")
var upgrader = websocket.Upgrader{} // use default options

func serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("error upgrading:", err)
		return
	}
	defer c.Close()

	// read first message
	_, message, err := c.ReadMessage()
	var initParams struct {
		Seed  int32
		Index int8
	}
	json.Unmarshal(message, &initParams)
	log.Println("starting game:", initParams)

	// signal that we are read and send player name
	err = c.WriteMessage(websocket.BinaryMessage, []byte(NAME))
	if err != nil {
		log.Println(err)
		return
	}

	// Loop until the game is over
	for {
		_, message, err = c.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		log.Println(message)
		// send hue and name

		c.WriteMessage(websocket.BinaryMessage, []byte{0})
	}

}

func serveHome(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)
	if r.URL.Path == "/zstd.wasm" {
		w.Header().Set("Content-Type", "application/wasm")
		if strings.Contains(r.Header.Get("Accept-Encoding"), "br") {
			w.Header().Set("Content-Encoding", "br")
			http.ServeFile(w, r, "zstd.wasm.br")
		} else {
			http.ServeFile(w, r, "zstd.wasm")
		}

		return
	}
	if r.URL.Path == "/zstd.js" {
		w.Header().Set("Content-Type", "application/javascript")
		/*	if strings.Contains(r.Header.Get("Accept-Encoding"), "br") {
			w.Header().Set("Content-Encoding", "br")
			http.ServeFile(w, r, "zstd.js.br")
		} else {*/
		http.ServeFile(w, r, "zstd.js")
		/*}*/

		return
	}
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "index.html")
}

func main() {
	flag.Parse()
	log.SetFlags(0)
	http.HandleFunc("/play", serveWs)
	http.HandleFunc("/", serveHome)
	log.Println("server listening on port " + *port)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}
