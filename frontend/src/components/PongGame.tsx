import { useEffect, useRef, useState } from "react";
import type { ServerMessage, StateBufferItem, GameStats } from "../types";

interface PongGameProps {
	socket: WebSocket;
	myId: "p1" | "p2";
	onLeaveRoom: () => void;
}

// Particle system interface
interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	color: string;
}

export const PongGame = ({ socket, myId, onLeaveRoom }: PongGameProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isGameOver, setIsGameOver] = useState(false);
	const [gameOverMsg, setGameOverMsg] = useState("");
	const [gameStats, setGameStats] = useState<GameStats | null>(null);

	useEffect(() => {
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
		let particles: Particle[] = []; // Array to hold explosion particles

		const PADDLE_SPEED = 8;
		let inputDir = 0;
		let lastScoreP1 = 0;
		let lastScoreP2 = 0;
		let lastBallVx = 0;

		// Helper to spawn particles on paddle hit
		const spawnParticles = (x: number, y: number, color: string) => {
			for (let i = 0; i < 15; i++) {
				particles.push({
					x,
					y,
					vx: (Math.random() - 0.5) * 10,
					vy: (Math.random() - 0.5) * 10,
					life: 1.0,
					color,
				});
			}
		};

		const handleSocketMessage = (event: MessageEvent) => {
			const data = JSON.parse(event.data) as ServerMessage;

			if (data.type === "state" && data.state && data.serverTime) {
				// Check for paddle hit (velocity change on X axis) to spawn particles
				if (
					lastBallVx !== 0 &&
					Math.sign(data.state.ball.vx) !== Math.sign(lastBallVx)
				) {
					const hitColor = data.state.ball.x < 400 ? "#0ff" : "#ff00ff"; // Cyan for P1, Pink for P2
					spawnParticles(data.state.ball.x, data.state.ball.y, hitColor);
				}
				lastBallVx = data.state.ball.vx;

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
			} else if (data.type === "game_over" && data.stats && data.message) {
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

			// TRICK: Instead of clearRect, we fill with slight transparency for a neon trail effect!
			ctx.fillStyle = "rgba(10, 10, 15, 0.3)";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			if (stateBuffer.length > 1) {
				const latestState = stateBuffer[stateBuffer.length - 1].state;

				// Draw Net
				ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
				for (let i = 0; i < canvas.height; i += 40) {
					ctx.fillRect(canvas.width / 2 - 2, i, 4, 20);
				}

				// Draw Paddles (Neon Cyan and Pink)
				ctx.shadowBlur = 15; // Glow effect
				if (myId === "p1") {
					ctx.shadowColor = "#0ff";
					ctx.fillStyle = "#0ff";
					ctx.fillRect(50, localPlayerY, 20, 100);
					ctx.shadowColor = "#ff00ff";
					ctx.fillStyle = "#ff00ff";
					ctx.fillRect(730, latestState.p2.y, 20, 100);
				} else {
					ctx.shadowColor = "#0ff";
					ctx.fillStyle = "#0ff";
					ctx.fillRect(50, latestState.p1.y, 20, 100);
					ctx.shadowColor = "#ff00ff";
					ctx.fillStyle = "#ff00ff";
					ctx.fillRect(730, localPlayerY, 20, 100);
				}

				// Draw Ball (Neon Green)
				ctx.shadowColor = "#39ff14";
				ctx.fillStyle = "#39ff14";
				ctx.fillRect(latestState.ball.x, latestState.ball.y, 15, 15);
				ctx.shadowBlur = 0; // Reset shadow for score/particles to save performance

				// Draw and update particles
				particles = particles.filter((p) => p.life > 0);
				particles.forEach((p) => {
					ctx.fillStyle = p.color;
					ctx.globalAlpha = p.life;
					ctx.fillRect(p.x, p.y, 4, 4);
					p.x += p.vx;
					p.y += p.vy;
					p.life -= 0.05; // Fade out speed
				});
				ctx.globalAlpha = 1.0;

				// Draw Score with Retro Font
				ctx.fillStyle = "#fff";
				ctx.font = "48px 'Press Start 2P', monospace";
				ctx.fillText(latestState.p1.score.toString(), canvas.width / 4 - 24, 80);
				ctx.fillText(
					latestState.p2.score.toString(),
					(canvas.width / 4) * 3 - 24,
					80,
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

	if (isGameOver && gameStats) {
		const myStats = myId === "p1" ? gameStats.p1 : gameStats.p2;
		const enemyStats = myId === "p1" ? gameStats.p2 : gameStats.p1;
		const eloChange = myStats.newElo - myStats.oldElo;

		return (
			<div className='w-[800px] h-[600px] bg-gray-900 border-4 border-gray-700 flex flex-col items-center justify-center text-white font-arcade relative crt'>
				<h1
					className={`text-4xl ${eloChange > 0 ? "text-neon-green" : "text-red-500"} mb-10 text-center leading-relaxed`}
				>
					{gameOverMsg}
				</h1>

				<div className='flex gap-16 text-center'>
					<div>
						<h3 className='text-xl mb-4'>
							You
							<br />
							<span className='text-sm text-gray-400'>{myStats.username}</span>
						</h3>
						<p className='text-2xl'>ELO: {myStats.newElo}</p>
						<p
							className={`text-lg mt-2 ${eloChange > 0 ? "text-neon-green" : "text-red-500"}`}
						>
							{eloChange > 0 ? "+" : ""}
							{eloChange}
						</p>
					</div>
					<div>
						<h3 className='text-xl mb-4'>
							Enemy
							<br />
							<span className='text-sm text-gray-400'>{enemyStats.username}</span>
						</h3>
						<p className='text-2xl text-gray-500'>ELO: {enemyStats.newElo}</p>
					</div>
				</div>

				<button
					onClick={onLeaveRoom}
					className='mt-16 px-8 py-4 bg-neon-blue text-black hover:bg-white transition-colors uppercase text-sm'
				>
					Insert Coin (Return)
				</button>
			</div>
		);
	}

	return (
		<div className='relative crt inline-block'>
			<canvas
				ref={canvasRef}
				width={800}
				height={600}
				className='bg-[#0a0a0f] border-4 border-gray-700 shadow-[0_0_20px_rgba(0,255,255,0.2)]'
			/>
		</div>
	);
};
