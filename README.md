# Tron-AI
A small ai project to learn to code in any language

## Prepare your setups

### Clone the repo
```shell
# install git
git clone https://github.com/kigiri/tron-ai.git
cd tron-ai/
```
> I recommand to use your own fork and clone it with `ssh`

## Choose your language of choice

#### `NODEJS`
```shell
# install nodejs
cd js
node main.js
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

Open https://tron.oct.ovh/?size=128&ai=noname+noname+noname (I started 3 times against the same AI here)

You can edit the url parameters as you want.

### Edit the url parameters
#### `ai=noname+noname`
Name of the AIs you want to start the game with, separated by `+`

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
