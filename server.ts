import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PADDLE_H = 100;
const PADDLE_W = 20;
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;
const TICK_RATE = 1000 / 60; // 60 FPS

//Single Source of Truth
let gameState = {
	p1: { y: 250, score: 0, movingUp: false, movingDown: false },
	p2: { y: 250, score: 0, movingUp: false, movingDown: false },
	ball: { x: 400, y: 300, vx: 5, vy: 5 },
};

let clients: WebSocket[] = [];

wss.on("connection", (ws: WebSocket) => {
	clients.push(ws);

	const playerId = clients.length === 1 ? "p1" : "p2";
	console.log(`Player ${playerId === "p1" ? "1 (Left)" : "2 (Right)"} joined!`);

	ws.on("message", (message: string) => {
		const data = JSON.parse(message);

		if (data.type === "keydown") {
			if (data.key === "UP") gameState[playerId].movingUp = true;
			if (data.key === "DOWN") gameState[playerId].movingDown = true;
		} else if (data.type === "keyup") {
			if (data.key === "UP") gameState[playerId].movingUp = false;
			if (data.key === "DOWN") gameState[playerId].movingDown = false;
		}
	});

	ws.on("close", () => {
		clients = clients.filter((client) => client !== ws);
		console.log(`Player ${playerId} disconnected.`);
		gameState[playerId].movingUp = false;
		gameState[playerId].movingDown = false;
	});
});

// GAME LOOP ---
setInterval(() => {
	if (gameState.p1.movingUp)
		gameState.p1.y = Math.max(0, gameState.p1.y - PADDLE_SPEED);
	if (gameState.p1.movingDown)
		gameState.p1.y = Math.min(
			GAME_HEIGHT - PADDLE_H,
			gameState.p1.y + PADDLE_SPEED,
		);

	if (gameState.p2.movingUp)
		gameState.p2.y = Math.max(0, gameState.p2.y - PADDLE_SPEED);
	if (gameState.p2.movingDown)
		gameState.p2.y = Math.min(
			GAME_HEIGHT - PADDLE_H,
			gameState.p2.y + PADDLE_SPEED,
		);

	gameState.ball.x += gameState.ball.vx;
	gameState.ball.y += gameState.ball.vy;

	if (gameState.ball.y <= 0 || gameState.ball.y + BALL_SIZE >= GAME_HEIGHT) {
		gameState.ball.vy *= -1;
	}

	if (
		gameState.ball.x <= 50 + PADDLE_W &&
		gameState.ball.y + BALL_SIZE >= gameState.p1.y &&
		gameState.ball.y <= gameState.p1.y + PADDLE_H
	) {
		gameState.ball.vx *= -1;
		gameState.ball.x = 50 + PADDLE_W;
	}

	if (
		gameState.ball.x + BALL_SIZE >= GAME_WIDTH - 50 - PADDLE_W &&
		gameState.ball.y + BALL_SIZE >= gameState.p2.y &&
		gameState.ball.y <= gameState.p2.y + PADDLE_H
	) {
		gameState.ball.vx *= -1;
		gameState.ball.x = GAME_WIDTH - 50 - PADDLE_W - BALL_SIZE;
	}

	if (gameState.ball.x < 0) {
		gameState.p2.score++;
		resetBall();
	}
	if (gameState.ball.x > GAME_WIDTH) {
		gameState.p1.score++;
		resetBall();
	}

	const payload = JSON.stringify(gameState);
	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(payload);
		}
	});
}, TICK_RATE);

function resetBall() {
	gameState.ball = {
		x: GAME_WIDTH / 2,
		y: GAME_HEIGHT / 2,
		vx: 5 * (Math.random() > 0.5 ? 1 : -1),
		vy: 5 * (Math.random() > 0.5 ? 1 : -1),
	};
}

console.log("Serwer Pong is working on port 8080...");
