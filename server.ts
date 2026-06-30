import { WebSocketServer, WebSocket, RawData } from "ws";

const wss = new WebSocketServer({ port: 8080 });

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
}

interface Room {
	id: string;
	players: PlayerInfo[];
	gameState: GameState;
	inputQueues: { p1: InputData[]; p2: InputData[] };
	loop: NodeJS.Timeout | null;
}

interface NetworkMessage {
	type: "join_room" | "chat" | "input";
	roomId?: string;
	text?: string;
	seq?: number;
	dir?: number;
}

// Map of all active rooms
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

		// 1. JOIN ROOM
		if (data.type === "join_room" && data.roomId) {
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
			room.players.push({ ws, id: myPlayerId });

			ws.send(JSON.stringify({ type: "init", id: myPlayerId }));

			broadcastToRoom(roomId, {
				type: "chat",
				sender: "SYSTEM",
				text: `Player ${myPlayerId} joined room ${roomId}`,
			});

			if (room.players.length === 2 && !room.loop) {
				startGameLoop(roomId);
			}
		}

		// 2. CHAT
		else if (data.type === "chat" && currentRoomId && myPlayerId && data.text) {
			broadcastToRoom(currentRoomId, {
				type: "chat",
				sender: myPlayerId,
				text: data.text,
			});
		}

		// 3. GAME INPUT
		else if (
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

				// Clear and delete room if empty
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

// Loop logic encapsulated inside the room context
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

		if (state.ball.x < 0) {
			state.p2.score++;
			resetBall(state.ball);
		}
		if (state.ball.x > GAME_WIDTH) {
			state.p1.score++;
			resetBall(state.ball);
		}

		broadcastToRoom(roomId, {
			type: "state",
			state: state,
			serverTime: Date.now(),
		});
	}, TICK_RATE);

	console.log(`Game loop in room ${roomId} started.`);
}

function resetBall(ball: BallState) {
	ball.x = 400;
	ball.y = 300;
	ball.vx = 5 * (Math.random() > 0.5 ? 1 : -1);
	ball.vy = 5 * (Math.random() > 0.5 ? 1 : -1);
}

console.log("Server with room support running on port 8080...");
