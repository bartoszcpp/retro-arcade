import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PADDLE_H = 100;
const PADDLE_W = 20;
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;
const TICK_RATE = 1000 / 30; // Serwer działa w 30 FPS, by udowodnić moc interpolacji

let gameState = {
	p1: { y: 250, score: 0, lastProcessedSeq: 0 },
	p2: { y: 250, score: 0, lastProcessedSeq: 0 },
	ball: { x: 400, y: 300, vx: 5, vy: 5 },
};

const inputQueues = {
	p1: [] as { seq: number; dir: number }[],
	p2: [] as { seq: number; dir: number }[],
};

let clients: { ws: WebSocket; id: "p1" | "p2" }[] = [];

function resetBall() {
	gameState.ball = {
		x: GAME_WIDTH / 2 - BALL_SIZE / 2,
		y: GAME_HEIGHT / 2 - BALL_SIZE / 2,
		vx: 6 * (Math.random() > 0.5 ? 1 : -1),
		vy: 4 * (Math.random() > 0.5 ? 1 : -1),
	};
}

wss.on("connection", (ws: WebSocket) => {
	const playerId = clients.some((c) => c.id === "p1") ? "p2" : "p1";
	clients.push({ ws, id: playerId });
	console.log(`Gracz ${playerId} dołączył do gry.`);

	ws.send(JSON.stringify({ type: "init", id: playerId }));

	ws.on("message", (message: string) => {
		const data = JSON.parse(message);
		if (data.type === "input") {
			inputQueues[playerId].push({ seq: data.seq, dir: data.dir });
		}
	});

	ws.on("close", () => {
		clients = clients.filter((c) => c.ws !== ws);
		console.log(`Gracz ${playerId} opuścił grę.`);
	});
});

// Główna pętla gry (Autorytatywna fizyka i kolizje)
setInterval(() => {
	// 1. Przetwarzanie wejść od graczy
	while (inputQueues.p1.length > 0) {
		const input = inputQueues.p1.shift()!;
		gameState.p1.y += input.dir * PADDLE_SPEED;
		gameState.p1.y = Math.max(
			0,
			Math.min(GAME_HEIGHT - PADDLE_H, gameState.p1.y),
		);
		gameState.p1.lastProcessedSeq = input.seq;
	}

	while (inputQueues.p2.length > 0) {
		const input = inputQueues.p2.shift()!;
		gameState.p2.y += input.dir * PADDLE_SPEED;
		gameState.p2.y = Math.max(
			0,
			Math.min(GAME_HEIGHT - PADDLE_H, gameState.p2.y),
		);
		gameState.p2.lastProcessedSeq = input.seq;
	}

	// 2. Autorytatywny ruch piłki
	gameState.ball.x += gameState.ball.vx;
	gameState.ball.y += gameState.ball.vy;

	// Kolizje ze ścianami góra/dół
	if (gameState.ball.y <= 0 || gameState.ball.y + BALL_SIZE >= GAME_HEIGHT) {
		gameState.ball.vy *= -1;
	}

	// Kolizja z paletką P1 (X: 50, szerokość: 20)
	if (
		gameState.ball.x <= 50 + PADDLE_W &&
		gameState.ball.x + BALL_SIZE >= 50 &&
		gameState.ball.y + BALL_SIZE >= gameState.p1.y &&
		gameState.ball.y <= gameState.p1.y + PADDLE_H
	) {
		gameState.ball.vx = Math.abs(gameState.ball.vx); // Odbicie w prawo
		gameState.ball.x = 50 + PADDLE_W; // Wyciągnięcie z kolizji
	}

	// Kolizja z paletką P2 (X: 730, szerokość: 20)
	if (
		gameState.ball.x + BALL_SIZE >= 730 &&
		gameState.ball.x <= 730 + PADDLE_W &&
		gameState.ball.y + BALL_SIZE >= gameState.p2.y &&
		gameState.ball.y <= gameState.p2.y + PADDLE_H
	) {
		gameState.ball.vx = -Math.abs(gameState.ball.vx); // Odbicie w lewo
		gameState.ball.x = 730 - BALL_SIZE; // Wyciągnięcie z kolizji
	}

	// Punktacja i reset piłki
	if (gameState.ball.x < 0) {
		gameState.p2.score++;
		resetBall();
	} else if (gameState.ball.x > GAME_WIDTH) {
		gameState.p1.score++;
		resetBall();
	}

	// 3. Wysłanie stanu z sygnaturą czasową serwera
	const payload = JSON.stringify({
		type: "state",
		state: gameState,
		serverTime: Date.now(),
	});

	clients.forEach((client) => {
		if (client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(payload);
		}
	});
}, TICK_RATE);

console.log(
	"Autorytatywny serwer z pełnymi zasadami Pong działający na porcie 8080...",
);
