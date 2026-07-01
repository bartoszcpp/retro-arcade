import { useEffect, useRef, useState } from "react";
import type { ServerMessage, StateBufferItem, GameStats } from "../types";

interface PongGameProps {
	socket: WebSocket;
	myId: "p1" | "p2";
	onLeaveRoom: () => void; // New prop to handle going back to lobby
}

export const PongGame = ({ socket, myId, onLeaveRoom }: PongGameProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// New states for Game Over logic
	const [isGameOver, setIsGameOver] = useState(false);
	const [gameOverMsg, setGameOverMsg] = useState("");
	const [gameStats, setGameStats] = useState<GameStats | null>(null);

	useEffect(() => {
		// If game is over, we don't need to run the canvas logic
		if (isGameOver) return;

		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		let localPlayerY = 250;
		let currentSequenceNumber = 0;
		let pendingInputs: { seq: number; dir: number }[] = [];
		let stateBuffer: StateBufferItem[] = [];

		const PADDLE_SPEED = 8;
		let inputDir = 0;
		let lastScoreP1 = 0;
		let lastScoreP2 = 0;

		const handleSocketMessage = (event: MessageEvent) => {
			const data = JSON.parse(event.data) as ServerMessage;

			if (data.type === "state" && data.state && data.serverTime) {
				if (
					data.state.p1.score !== lastScoreP1 ||
					data.state.p2.score !== lastScoreP2
				) {
					stateBuffer = [];
					lastScoreP1 = data.state.p1.score;
					lastScoreP2 = data.state.p2.score;
				}

				stateBuffer.push({ state: data.state, time: data.serverTime });
				if (stateBuffer.length > 30) stateBuffer.shift();

				const serverMe = data.state[myId];
				localPlayerY = serverMe.y;
				pendingInputs = pendingInputs.filter(
					(input) => input.seq > serverMe.lastProcessedSeq,
				);
				pendingInputs.forEach((input) => {
					localPlayerY += input.dir * PADDLE_SPEED;
				});
			}
			// NEW: Catch Game Over
			else if (data.type === "game_over" && data.stats && data.message) {
				setIsGameOver(true);
				setGameOverMsg(data.message);
				setGameStats(data.stats);
			}
		};

		socket.addEventListener("message", handleSocketMessage);

		const handleKeyDown = (e: KeyboardEvent) => {
			if (document.activeElement?.tagName === "INPUT") return;
			if (e.key === "ArrowUp") {
				e.preventDefault();
				inputDir = -1;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				inputDir = 1;
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (
				(e.key === "ArrowUp" && inputDir === -1) ||
				(e.key === "ArrowDown" && inputDir === 1)
			) {
				inputDir = 0;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		const renderLoop = () => {
			if (inputDir !== 0) {
				currentSequenceNumber++;
				const input = { seq: currentSequenceNumber, dir: inputDir };
				localPlayerY = Math.max(
					0,
					Math.min(600 - 100, localPlayerY + input.dir * PADDLE_SPEED),
				);
				pendingInputs.push(input);
				socket.send(JSON.stringify({ type: "input", ...input }));
			}

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (stateBuffer.length > 1) {
				const latestState = stateBuffer[stateBuffer.length - 1].state;
				ctx.fillStyle = "#fff";

				for (let i = 0; i < canvas.height; i += 40) {
					ctx.fillRect(canvas.width / 2 - 2, i, 4, 20);
				}

				if (myId === "p1") {
					ctx.fillRect(50, localPlayerY, 20, 100);
					ctx.fillRect(730, latestState.p2.y, 20, 100);
				} else {
					ctx.fillRect(50, latestState.p1.y, 20, 100);
					ctx.fillRect(730, localPlayerY, 20, 100);
				}

				ctx.fillRect(latestState.ball.x, latestState.ball.y, 15, 15);

				ctx.font = "48px monospace";
				ctx.fillText(latestState.p1.score.toString(), canvas.width / 4, 70);
				ctx.fillText(
					latestState.p2.score.toString(),
					(canvas.width / 4) * 3 - 30,
					70,
				);
			}

			animationFrameId = requestAnimationFrame(renderLoop);
		};

		renderLoop();

		return () => {
			socket.removeEventListener("message", handleSocketMessage);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			cancelAnimationFrame(animationFrameId);
		};
	}, [socket, myId, isGameOver]);

	// --- GAME OVER OVERLAY RENDERING ---
	if (isGameOver && gameStats) {
		const myStats = myId === "p1" ? gameStats.p1 : gameStats.p2;
		const enemyStats = myId === "p1" ? gameStats.p2 : gameStats.p1;
		const eloChange = myStats.newElo - myStats.oldElo;

		return (
			<div
				style={{
					width: "800px",
					height: "600px",
					background: "#222",
					border: "4px solid #333",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					color: "white",
					fontFamily: "sans-serif",
				}}
			>
				<h1
					style={{ fontSize: "48px", color: eloChange > 0 ? "#4cd137" : "#e84118" }}
				>
					{gameOverMsg}
				</h1>

				<div
					style={{
						display: "flex",
						gap: "50px",
						marginTop: "30px",
						textAlign: "center",
					}}
				>
					<div>
						<h3>You ({myStats.username})</h3>
						<p style={{ fontSize: "24px" }}>
							ELO: {myStats.newElo}{" "}
							<span style={{ color: eloChange > 0 ? "#4cd137" : "#e84118" }}>
								({eloChange > 0 ? "+" : ""}
								{eloChange})
							</span>
						</p>
					</div>
					<div>
						<h3>Opponent ({enemyStats.username})</h3>
						<p style={{ fontSize: "24px", color: "#7f8fa6" }}>
							ELO: {enemyStats.newElo}
						</p>
					</div>
				</div>

				<button
					onClick={onLeaveRoom}
					style={{
						marginTop: "50px",
						padding: "15px 30px",
						fontSize: "20px",
						cursor: "pointer",
						background: "#fbc531",
						border: "none",
						borderRadius: "5px",
						fontWeight: "bold",
					}}
				>
					Return to Lobby
				</button>
			</div>
		);
	}

	// --- NORMAL GAME RENDERING ---
	return (
		<canvas
			ref={canvasRef}
			width={800}
			height={600}
			style={{ background: "#222", border: "4px solid #333" }}
		/>
	);
};
