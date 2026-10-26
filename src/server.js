import "dotenv/config";
import http from "http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import numberCalRoutes from "./routes/numberCalRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import subCategoryRoutes from "./routes/subCategoryRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import batchInvoiceRoutes from "./routes/batchInvoiceRoutes.js";

import { configureSocket } from "./socket/index.js";

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from environment variables.");
}

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/number-cal", numberCalRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/sub-categories", subCategoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/batch-invoices", batchInvoiceRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

const io = new Server(server, {
  cors: {
    origin: clientUrl,
    credentials: true,
  },
});

configureSocket(io);

async function start() {
  await connectDB();
  server.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
