# Tron-AI
A small ai project to learn to code in any language

## Prepare your setups

### Clone the repo
```shell
# install git
git clone https://github.com/kigiri/tron-ai.git
cd tron-ai/go
```
> I recommand to use your own fork and clone it with `ssh`

## Choose your language of choice

#### `NODEJS`
```shell
# install nodejs
cd js
node server.js
```

> Open the file `ai.js`


#### `GOLANG`
```shell
# install go
cd go
go get
go run ai.go main.go
```

> Open the file `ai.go` *(in go, after saving, you must restart the server)*

## Test your code

Open https://kigiri.github.io/tron-ai/?size=128&ai=3432,3432,3432 (I started 3 times against the same AI here, looking on port `3432`)

You can edit the url parameters as you want.

### Edit the url parameters
#### `ai=3432`
- Numbers are used as ports in `localhost`
- Simple words are resolved throught serveo *(ex: `barba` -> `wss://barba.serveo.net`)*
- Missing protocol is added to urls (ex: `vieux.pro/ai-tron` -> `wss://vieux.pro/ai-tron`)

#### `size=254`
control the size of the map, minmum 8, maximum 254

> Small maps are usefull for testing

#### `seed=132456789`
You can fix the seed to replay always the same game.
Very usefull for working on specific cases !

#### `fast=1`
Enable async rendering, might fuck up the quality, use if it's laggy

> You can also use the local `index.html` file if you want to fiddle with the client code

### Controls
- `Scroll` (move in the timeline)
- `Left / Right` (move in the timeline step by step)
- `s` (reload game with a new seed)

## Expose your AI
In another shell
```shell
ssh -R 80:localhost:8751 serveo.net
```
You can now share your AI using the serveo generated link

Other ways:
- Configure your box to expose a port online (your computer must be online too)
- Pay a server (scaleway make cheap 2e/month servers, but performances are bad)
- Share your AI code directly