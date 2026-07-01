import { WebSocketServer, WebSocket, RawData } from "ws";
import jwt from "jsonwebtoken";
import type { NetworkMessage, TokenPayload } from "../types";
import {
	rooms,
	createInitialGameState,
	broadcastToRoom,
	startGameLoop,
} from "../game/engine";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

export function setupWebSockets(wss: WebSocketServer) {
	wss.on("connection", (ws: WebSocket) => {
		let currentRoomId: string | null = null;
		let myPlayerId: "p1" | "p2" | null = null;

		ws.on("message", (message: RawData) => {
			const data = JSON.parse(message.toString()) as NetworkMessage;

			if (data.type === "join_room" && data.roomId) {
				if (!data.token)
					return ws.send(
						JSON.stringify({ type: "error", message: "Missing token" }),
					);

				let decoded: TokenPayload;
				try {
					decoded = jwt.verify(data.token, JWT_SECRET) as TokenPayload;
				} catch (err) {
					return ws.send(
						JSON.stringify({ type: "error", message: "Invalid token" }),
					);
				}

				const roomId = data.roomId;
				if (!rooms.has(roomId)) {
					rooms.set(roomId, {
						id: roomId,
						players: [],
						gameState: createInitialGameState(),
						inputQueues: { p1: [], p2: [] },
						loop: null,
					});
				}

				const room = rooms.get(roomId)!;
				if (room.players.length >= 2)
					return ws.send(
						JSON.stringify({ type: "error", message: "Room is full!" }),
					);

				currentRoomId = roomId;
				myPlayerId = room.players.length === 0 ? "p1" : "p2";

				room.players.push({
					ws,
					id: myPlayerId,
					dbUserId: decoded.userId,
					username: decoded.username,
				});

				ws.send(JSON.stringify({ type: "init", id: myPlayerId }));
				broadcastToRoom(roomId, {
					type: "chat",
					sender: "SYSTEM",
					text: `${decoded.username} joined!`,
				});

				if (room.players.length === 2 && !room.loop) startGameLoop(roomId);
			} else if (
				data.type === "chat" &&
				currentRoomId &&
				myPlayerId &&
				data.text
			) {
				broadcastToRoom(currentRoomId, {
					type: "chat",
					sender: myPlayerId,
					text: data.text,
				});
			} else if (
				data.type === "input" &&
				currentRoomId &&
				myPlayerId &&
				data.seq !== undefined &&
				data.dir !== undefined
			) {
				rooms
					.get(currentRoomId)
					?.inputQueues[myPlayerId].push({ seq: data.seq, dir: data.dir });
			}
		});

		ws.on("close", () => {
			if (currentRoomId && myPlayerId) {
				const room = rooms.get(currentRoomId);
				if (room) {
					room.players = room.players.filter((p) => p.ws !== ws);
					broadcastToRoom(currentRoomId, {
						type: "chat",
						sender: "SYSTEM",
						text: `Player left.`,
					});
					if (room.players.length === 0) {
						if (room.loop) clearInterval(room.loop);
						rooms.delete(currentRoomId);
					}
				}
			}
		});
	});
}
