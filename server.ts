import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let position = { x: 250, y: 250 };
const SPEED = 10; // Feed rate

wss.on("connection", (ws: WebSocket) => {
	console.log("New client connected!");

	// Send actual position to the newly connected client
	ws.send(JSON.stringify(position));

	// Listen for messages coming from this client
	ws.on("message", (message: string) => {
		const data = JSON.parse(message);

		if (data.direction === "UP") position.y -= SPEED;
		if (data.direction === "DOWN") position.y += SPEED;
		if (data.direction === "LEFT") position.x -= SPEED;
		if (data.direction === "RIGHT") position.x += SPEED;

		const payload = JSON.stringify(position);

		wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(payload);
			}
		});
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
});

console.log("WebSocket server listening on port 8080...");
