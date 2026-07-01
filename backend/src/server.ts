import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import apiRoutes from "./routes/api";
import { setupWebSockets } from "./sockets/handlers";

const PORT = process.env.PORT || 8080;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// HTTP Routes
app.use("/api", apiRoutes);

// Server & WebSockets Initialization
const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSockets(wss);

server.listen(PORT, () => {
	console.log(`HTTP and WebSocket server running cleanly on port ${PORT}...`);
});
