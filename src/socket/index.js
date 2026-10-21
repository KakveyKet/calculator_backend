import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);

      if (!user || !user.isActive) {
        return next(new Error("Authentication required"));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.user.email}`);

    socket.join(`user:${socket.user._id}`);

    socket.emit("socket:ready", {
      message: "Socket authenticated successfully.",
      userId: socket.user._id,
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.user.email}`);
    });
  });
}
