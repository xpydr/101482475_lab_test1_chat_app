const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const { JWT_SECRET } = require("../middleware/auth");

const MAX_MESSAGES = 100;

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    let authenticated = false;
    let currentUser = null;

    socket.on("authenticate", (data) => {
      try {
        if (!data || !data.token) {
          socket.emit("auth-error", { message: "Token required" });
          return;
        }

        const decoded = jwt.verify(data.token, JWT_SECRET);
        currentUser = {
          userId: decoded.userId,
          username: decoded.username,
        };
        authenticated = true;
        socket.emit("authenticated", { username: currentUser.username });
      } catch (error) {
        socket.emit("auth-error", { message: "Invalid or expired token" });
      }
    });

    const requireAuth = (callback) => {
      return (...args) => {
        if (!authenticated || !currentUser) {
          socket.emit("auth-error", { message: "Authentication required" });
          return;
        }
        callback(...args);
      };
    };

    socket.on(
      "join-room",
      requireAuth(async ({ room }) => {
        if (!room) return;

        socket.currentRoom = room;
        socket.join(room);

        const messages = await Message.find({ type: "group", room }).populate("sender", "username").sort({ createdAt: 1 }).limit(MAX_MESSAGES).lean();

        const formattedMessages = messages.map((m) => ({
          id: m._id,
          content: m.content,
          sender: m.sender ? m.sender.username : "Unknown",
          createdAt: m.createdAt,
        }));

        socket.emit("previous-messages", { messages: formattedMessages });
        socket.to(room).emit("user-joined", { username: currentUser.username });
      }),
    );

    socket.on(
      "leave-room",
      requireAuth(({ room }) => {
        if (room && socket.currentRoom === room) {
          socket.to(room).emit("user-left", { username: currentUser.username });
          socket.leave(room);
          socket.currentRoom = null;
          socket.emit("left-room", { room });
        }
      }),
    );

    socket.on(
      "send-message",
      requireAuth(async ({ room, content }) => {
        if (!room || !content || socket.currentRoom !== room) return;

        const message = new Message({
          type: "group",
          room,
          sender: currentUser.userId,
          content: content.trim(),
        });
        await message.save();

        const populated = await Message.findById(message._id).populate("sender", "username").lean();

        const messageData = {
          id: populated._id,
          content: populated.content,
          sender: populated.sender ? populated.sender.username : currentUser.username,
          createdAt: populated.createdAt,
        };

        io.to(room).emit("new-message", { message: messageData });
      }),
    );

    socket.on(
      "typing-start",
      requireAuth(({ room }) => {
        if (room && socket.currentRoom === room) {
          socket.to(room).emit("user-typing", { username: currentUser.username });
        }
      }),
    );

    socket.on(
      "typing-stop",
      requireAuth(({ room }) => {
        if (room && socket.currentRoom === room) {
          socket.to(room).emit("user-stopped-typing", { username: currentUser.username });
        }
      }),
    );

    socket.on("disconnect", () => {
      if (socket.currentRoom && currentUser) {
        socket.to(socket.currentRoom).emit("user-left", { username: currentUser.username });
      }
    });
  });
}

module.exports = setupSocketHandlers;
