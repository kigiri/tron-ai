# Tron-AI
A small ai project to learn to code in any language

## Build the go version

### Install Dependencies:
You will need `git`, `ssh` and `go`

#### Clone the repo
```shell
git clone https://github.com/kigiri/tron-ai.git
cd tron-ai/server
```
> I recommand to use your own fork and clone it with `ssh`

### Run the go server
```shell
go get
go run ai.go main.go
```

### Edit your AI
Open the file `server/ai.go`

> after saving, you must restart the server

### Expose your AI
In another shell
```shell
ssh -R 80:localhost:8751 serveo.net
```
You can now share your AI using the serveo generated link
