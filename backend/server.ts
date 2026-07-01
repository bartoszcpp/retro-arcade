import "dotenv/config"; // Load environment variables first!
import express, { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// --- NEW PRISMA 7 ADAPTER IMPORTS ---
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// --- CONFIGURATION & SETUP ---
const PORT = 8080;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// --- PRISMA INITIALIZATION ---
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json()); // Allows Express to parse JSON bodies

const server = createServer(app);
const wss = new WebSocketServer({ server });

// --- REST API: AUTHENTICATION ---

app.post("/api/register", async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			return res
				.status(400)
				.json({ error: "Username and password are required." });
		}

		const existingUser = await prisma.user.findUnique({ where: { username } });
		if (existingUser) {
			return res.status(409).json({ error: "Username already exists." });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = await prisma.user.create({
			data: {
				username,
				password: hashedPassword,
			},
		});

		return res
			.status(201)
			.json({ message: "User registered successfully", userId: newUser.id });
	} catch (error) {
		console.error("Registration error:", error);
		return res.status(500).json({ error: "Internal server error." });
	}
});

app.post("/api/login", async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			return res
				.status(400)
				.json({ error: "Username and password are required." });
		}

		const user = await prisma.user.findUnique({ where: { username } });
		if (!user) {
			return res.status(401).json({ error: "Invalid credentials." });
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(401).json({ error: "Invalid credentials." });
		}

		// Generate JWT Token
		const token = jwt.sign(
			{ userId: user.id, username: user.username },
			JWT_SECRET,
			{
				expiresIn: "24h",
			},
		);

		return res.status(200).json({
			message: "Login successful",
			token,
			user: { username: user.username, elo: user.elo },
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({ error: "Internal server error." });
	}
});

// --- WEBSOCKET GAME LOGIC ---

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PADDLE_H = 100;
const PADDLE_SPEED = 8;
const TICK_RATE = 1000 / 30;

interface PaddleState {
	y: number;
	score: number;
	lastProcessedSeq: number;
}

interface BallState {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

interface GameState {
	p1: PaddleState;
	p2: PaddleState;
	ball: BallState;
}

interface InputData {
	seq: number;
	dir: number;
}

interface PlayerInfo {
	ws: WebSocket;
	id: "p1" | "p2";
	dbUserId: string;
	username: string;
}
interface Room {
	id: string;
	players: PlayerInfo[];
	gameState: GameState;
	inputQueues: { p1: InputData[]; p2: InputData[] };
	loop: NodeJS.Timeout | null;
}

interface TokenPayload {
	userId: string;
	username: string;
}

interface NetworkMessage {
	type: "join_room" | "chat" | "input";
	roomId?: string;
	text?: string;
	seq?: number;
	dir?: number;
	token?: string; // NEW: JWT Token from frontend
}

const rooms = new Map<string, Room>();

function createInitialGameState(): GameState {
	return {
		p1: { y: 250, score: 0, lastProcessedSeq: 0 },
		p2: { y: 250, score: 0, lastProcessedSeq: 0 },
		ball: { x: 400, y: 300, vx: 5, vy: 5 },
	};
}

wss.on("connection", (ws: WebSocket) => {
	let currentRoomId: string | null = null;
	let myPlayerId: "p1" | "p2" | null = null;

	ws.on("message", (message: RawData) => {
		const data = JSON.parse(message.toString()) as NetworkMessage;

		if (data.type === "join_room" && data.roomId) {
			// 1. JWT Authentication
			if (!data.token) {
				ws.send(
					JSON.stringify({ type: "error", message: "Unauthorized: Missing token" }),
				);
				return;
			}

			let decoded: TokenPayload;
			try {
				decoded = jwt.verify(data.token, JWT_SECRET) as TokenPayload;
			} catch (err) {
				ws.send(
					JSON.stringify({ type: "error", message: "Unauthorized: Invalid token" }),
				);
				return;
			}

			// 2. Room Assignment
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

			if (room.players.length >= 2) {
				ws.send(JSON.stringify({ type: "error", message: "Room is full!" }));
				return;
			}

			currentRoomId = roomId;
			myPlayerId = room.players.length === 0 ? "p1" : "p2";

			// Push the authenticated user details into the room memory
			room.players.push({
				ws,
				id: myPlayerId,
				dbUserId: decoded.userId,
				username: decoded.username,
			});

			ws.send(JSON.stringify({ type: "init", id: myPlayerId }));

			// Announce the exact username in the chat
			broadcastToRoom(roomId, {
				type: "chat",
				sender: "SYSTEM",
				text: `Player ${decoded.username} (${myPlayerId}) joined room ${roomId}`,
			});

			if (room.players.length === 2 && !room.loop) {
				startGameLoop(roomId);
			}
		} else if (data.type === "chat" && currentRoomId && myPlayerId && data.text) {
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
			const room = rooms.get(currentRoomId);
			if (room) {
				room.inputQueues[myPlayerId].push({ seq: data.seq, dir: data.dir });
			}
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
					text: `Player ${myPlayerId} left the room.`,
				});

				if (room.players.length === 0) {
					if (room.loop) clearInterval(room.loop);
					rooms.delete(currentRoomId);
					console.log(`Room ${currentRoomId} was destroyed.`);
				}
			}
		}
	});
});

function broadcastToRoom(roomId: string, payload: unknown) {
	const room = rooms.get(roomId);
	if (!room) return;
	const msg = JSON.stringify(payload);
	room.players.forEach((p) => {
		if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
	});
}

function startGameLoop(roomId: string) {
	const room = rooms.get(roomId);
	if (!room) return;

	room.loop = setInterval(() => {
		const state = room.gameState;

		while (room.inputQueues.p1.length > 0) {
			const input = room.inputQueues.p1.shift();
			if (input) {
				state.p1.y = Math.max(
					0,
					Math.min(GAME_HEIGHT - PADDLE_H, state.p1.y + input.dir * PADDLE_SPEED),
				);
				state.p1.lastProcessedSeq = input.seq;
			}
		}

		while (room.inputQueues.p2.length > 0) {
			const input = room.inputQueues.p2.shift();
			if (input) {
				state.p2.y = Math.max(
					0,
					Math.min(GAME_HEIGHT - PADDLE_H, state.p2.y + input.dir * PADDLE_SPEED),
				);
				state.p2.lastProcessedSeq = input.seq;
			}
		}

		state.ball.x += state.ball.vx;
		state.ball.y += state.ball.vy;

		if (state.ball.y <= 0 || state.ball.y >= GAME_HEIGHT - 15) {
			state.ball.vy *= -1;
		}

		if (
			state.ball.x <= 50 + 20 &&
			state.ball.x + 15 >= 50 &&
			state.ball.y + 15 >= state.p1.y &&
			state.ball.y <= state.p1.y + PADDLE_H
		) {
			state.ball.vx = Math.abs(state.ball.vx);
			state.ball.x = 70;
		}

		if (
			state.ball.x + 15 >= 730 &&
			state.ball.x <= 730 + 20 &&
			state.ball.y + 15 >= state.p2.y &&
			state.ball.y <= state.p2.y + PADDLE_H
		) {
			state.ball.vx = -Math.abs(state.ball.vx);
			state.ball.x = 730 - 15;
		}

		// --- SCORING & GAME OVER CHECK ---
		const WINNING_SCORE = 10;

		if (state.ball.x < 0) {
			state.p2.score++;
			resetBall(state.ball);
		} else if (state.ball.x > GAME_WIDTH) {
			state.p1.score++;
			resetBall(state.ball);
		}

		// If someone reached the winning score, stop the interval!
		if (state.p1.score >= WINNING_SCORE || state.p2.score >= WINNING_SCORE) {
			if (room.loop) clearInterval(room.loop);
			handleGameOver(roomId, room);
			return; // Exit the loop
		}

		broadcastToRoom(roomId, {
			type: "state",
			state: state,
			serverTime: Date.now(),
		});
	}, TICK_RATE);

	console.log(`Game loop in room ${roomId} started.`);
}

// --- NEW FUNCTION: Calculate ELO and Update Database ---
async function handleGameOver(roomId: string, room: Room) {
	const p1 = room.players.find((p) => p.id === "p1");
	const p2 = room.players.find((p) => p.id === "p2");

	if (!p1 || !p2) {
		rooms.delete(roomId);
		return;
	}

	try {
		// Fetch current ELO from database to ensure accuracy
		const user1 = await prisma.user.findUnique({ where: { id: p1.dbUserId } });
		const user2 = await prisma.user.findUnique({ where: { id: p2.dbUserId } });

		if (user1 && user2) {
			const p1Won = room.gameState.p1.score >= 10;

			// Standard ELO Mathematical Formula
			const expected1 = 1 / (1 + Math.pow(10, (user2.elo - user1.elo) / 400));
			const expected2 = 1 / (1 + Math.pow(10, (user1.elo - user2.elo) / 400));

			const K = 32; // K-factor (max points gained/lost per game)
			const newElo1 = Math.round(user1.elo + K * ((p1Won ? 1 : 0) - expected1));
			const newElo2 = Math.round(user2.elo + K * ((p1Won ? 0 : 1) - expected2));

			// Update Database
			await prisma.user.update({
				where: { id: user1.id },
				data: { elo: newElo1 },
			});
			await prisma.user.update({
				where: { id: user2.id },
				data: { elo: newElo2 },
			});

			// Broadcast final results to the room
			broadcastToRoom(roomId, {
				type: "game_over",
				message: p1Won
					? `${p1.username} won the match!`
					: `${p2.username} won the match!`,
				stats: {
					p1: { username: p1.username, oldElo: user1.elo, newElo: newElo1 },
					p2: { username: p2.username, oldElo: user2.elo, newElo: newElo2 },
				},
			});
		}
	} catch (e) {
		console.error("Failed to update ELO in database", e);
	} finally {
		// Destroy the room instance
		rooms.delete(roomId);
		console.log(`Room ${roomId} closed after game over.`);
	}
}

function resetBall(ball: BallState) {
	ball.x = 400;
	ball.y = 300;
	ball.vx = 5 * (Math.random() > 0.5 ? 1 : -1);
	ball.vy = 5 * (Math.random() > 0.5 ? 1 : -1);
}

// Notice we are calling server.listen() instead of creating a standalone WebSocketServer
server.listen(PORT, () => {
	console.log(`HTTP and WebSocket server running on port ${PORT}...`);
});
