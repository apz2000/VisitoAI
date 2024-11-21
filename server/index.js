const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`a user connected ${socket.id}`);
  
  socket.on("send_message", (data) => {
    socket.broadcast.emit("receive_message", data);
  });
});
server.listen(4000, () => {
  console.log("listening on *:4000");
});

app.get("/api/notifications/:userId", (req, res) => {
    // return notifications by userId along with the status of the notification
    res.send("Hello World");
});

app.post("/api/notification/", (req, res) => {
    // add notification to queue and send to client
    res.send("Hello World");
});

app.patch("/api/notification/:id", (req, res) => {
    // update the status of the notification to read
    res.send("Hello World");
});

