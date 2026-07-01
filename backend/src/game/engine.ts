import { WebSocket } from "ws";
import { prisma } from "../config/database";
import type { Room, GameState, BallState } from "../types";

export const rooms = new Map<string, Room>();

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PADDLE_H = 100;
const PADDLE_SPEED = 8;
const TICK_RATE = 1000 / 30;
const WINNING_SCORE = 10;

export function createInitialGameState(): GameState {
	return {
		p1: { y: 250, score: 0, lastProcessedSeq: 0 },
		p2: { y: 250, score: 0, lastProcessedSeq: 0 },
		ball: { x: 400, y: 300, vx: 5, vy: 5 },
	};
}

export function resetBall(ball: BallState) {
	ball.x = 400;
	ball.y = 300;
	ball.vx = 5 * (Math.random() > 0.5 ? 1 : -1);
	ball.vy = 5 * (Math.random() > 0.5 ? 1 : -1);
}

export function broadcastToRoom(roomId: string, payload: unknown) {
	const room = rooms.get(roomId);
	if (!room) return;
	const msg = JSON.stringify(payload);
	room.players.forEach((p) => {
		if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
	});
}

export async function handleGameOver(roomId: string, room: Room) {
	const p1 = room.players.find((p) => p.id === "p1");
	const p2 = room.players.find((p) => p.id === "p2");

	if (!p1 || !p2) {
		rooms.delete(roomId);
		return;
	}

	try {
		const user1 = await prisma.user.findUnique({ where: { id: p1.dbUserId } });
		const user2 = await prisma.user.findUnique({ where: { id: p2.dbUserId } });

		if (user1 && user2) {
			const p1Won = room.gameState.p1.score >= WINNING_SCORE;
			const expected1 = 1 / (1 + Math.pow(10, (user2.elo - user1.elo) / 400));
			const expected2 = 1 / (1 + Math.pow(10, (user1.elo - user2.elo) / 400));
			const K = 32;
			const newElo1 = Math.round(user1.elo + K * ((p1Won ? 1 : 0) - expected1));
			const newElo2 = Math.round(user2.elo + K * ((p1Won ? 0 : 1) - expected2));

			await prisma.user.update({
				where: { id: user1.id },
				data: { elo: newElo1 },
			});
			await prisma.user.update({
				where: { id: user2.id },
				data: { elo: newElo2 },
			});

			broadcastToRoom(roomId, {
				type: "game_over",
				message: p1Won ? `${p1.username} won!` : `${p2.username} won!`,
				stats: {
					p1: { username: p1.username, oldElo: user1.elo, newElo: newElo1 },
					p2: { username: p2.username, oldElo: user2.elo, newElo: newElo2 },
				},
			});
		}
	} catch (e) {
		console.error("ELO Update Error", e);
	} finally {
		rooms.delete(roomId);
	}
}

export function startGameLoop(roomId: string) {
	const room = rooms.get(roomId);
	if (!room) return;

	room.loop = setInterval(() => {
		const state = room.gameState;

		// Paddle movement
		while (room.inputQueues.p1.length > 0) {
			const input = room.inputQueues.p1.shift()!;
			state.p1.y = Math.max(
				0,
				Math.min(GAME_HEIGHT - PADDLE_H, state.p1.y + input.dir * PADDLE_SPEED),
			);
			state.p1.lastProcessedSeq = input.seq;
		}
		while (room.inputQueues.p2.length > 0) {
			const input = room.inputQueues.p2.shift()!;
			state.p2.y = Math.max(
				0,
				Math.min(GAME_HEIGHT - PADDLE_H, state.p2.y + input.dir * PADDLE_SPEED),
			);
			state.p2.lastProcessedSeq = input.seq;
		}

		// Ball physics
		state.ball.x += state.ball.vx;
		state.ball.y += state.ball.vy;

		if (state.ball.y <= 0 || state.ball.y >= GAME_HEIGHT - 15)
			state.ball.vy *= -1;

		if (
			state.ball.x <= 70 &&
			state.ball.x + 15 >= 50 &&
			state.ball.y + 15 >= state.p1.y &&
			state.ball.y <= state.p1.y + PADDLE_H
		) {
			state.ball.vx = Math.abs(state.ball.vx);
			state.ball.x = 70;
		}
		if (
			state.ball.x + 15 >= 730 &&
			state.ball.x <= 750 &&
			state.ball.y + 15 >= state.p2.y &&
			state.ball.y <= state.p2.y + PADDLE_H
		) {
			state.ball.vx = -Math.abs(state.ball.vx);
			state.ball.x = 715;
		}

		// Scoring
		if (state.ball.x < 0) {
			state.p2.score++;
			resetBall(state.ball);
		} else if (state.ball.x > GAME_WIDTH) {
			state.p1.score++;
			resetBall(state.ball);
		}

		if (state.p1.score >= WINNING_SCORE || state.p2.score >= WINNING_SCORE) {
			if (room.loop) clearInterval(room.loop);
			handleGameOver(roomId, room);
			return;
		}

		broadcastToRoom(roomId, { type: "state", state, serverTime: Date.now() });
	}, TICK_RATE);
}
