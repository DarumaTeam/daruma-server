const exec = require("child_process").exec;
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const uuid = require("uuid");

class Server {
  constructor(port = 3052) {
    this.port = port;
    this.connectionClients = new Map;
    this.rooms = new Map;

    this.http = http.createServer();

    this.http.listen(this.port, () => {
      console.log("http server started.");
    });

    this.ws = new WebSocket.Server({
      server: this.http,
      verifyClient: info => {
        console.log(info.req.url);

        const room = this.parseRoomName(info.req.url);
        if (room === null) {
          console.log("connection rejected, due to no room number in query parameter.");
          return false;
        } else {
          console.log("will be connected.");
          return true;
        }
      }
    });

    process.on("unhandledRejection", console.dir);

    this.ws.on("connection", (ws, req) => {
      const uid = uuid.v4();

      const client = {
        ws: ws,
        uid: uid,
        room: null
      };

      this.connectionClients.set(client.uid, client);
      console.log(`[new connection]uid: ${client.uid}`);

      client.room = this.parseRoomName(req.url);
      const room = this.rooms.get(client.room) || new Map();

      room.set(client.uid, client);
      this.rooms.set(client.room, room);

      client.ws.on("close", () => {
        console.log(`[connection closed]uid: ${client.uid}`);
        const room = this.rooms.get(client.room);
        room.delete(client.uid);
        if(room.size == 0){
          this.rooms.delete(client.room);
        }
        this.connectionClients.delete(client.uid);
      });

      client.ws.on("message", message => {
        const data = JSON.parse(message);
        if (data.type === "data") {
          console.log(`[onmessage:data]: ${data.volt}, ${data.value}`);
          fs.appendFileSync("data.txt", `${data.value}\n`, "utf-8");
        }
        if (data.type === "status") {
          if (data.onoff === "COMMAND") {
            console.log(`[onmessage:status]: ${data.onoff}, ${data.command}`);
          } else {
            console.log(`[onmessage:status]: ${data.onoff}`);
          }
        }
        if (data.type === "message") {
          console.log(`[onmessage:voice]: ${data.message}`);
          this.playVoice(data.message);
          return;
        }
        if (data.type === "motor") {
          console.log(`[onmessage:motor]: ${data.stat}, ${data.err}`);
        }
        if (data.type === "speed") {
          console.log(`[onmessage:speed]: ${data.speed}`);
        }
        this.broadcastMessage(data, client);
      });

      client.ws.on("error", err => {
        console.log(err);
      });
    });
  }

  parseRoomName(urlParam) {
    const params = urlParam.replace("/?", "").split("&");
    for (const rawParam of params) {
      const param = rawParam.split("=");
      if (param.length === 2 && param[1] !== "" && param[0] === "room") {
        return param[1];
      }
    }
    return null;
  }

  broadcastMessage(message, peerClient) {
    const room = this.rooms.get(peerClient.room);
    for (const client of room) {
      if (client[1].uid !== peerClient.uid && client[1].ws.readyState === 1) {
        client[1].ws.send(JSON.stringify(message));
      }
    }
  };

  playVoice(message) {
    exec(`./jtalk.sh "${message}"`, (err, stdout, stderr) => {
    });
  };
}

const server = new Server();
