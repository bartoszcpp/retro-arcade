import { WebSocket } from "ws";

export interface TokenPayload {
	userId: string;
	username: string;
}

export interface PaddleState {
	y: number;
	score: number;
	lastProcessedSeq: number;
}

export interface BallState {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export interface GameState {
	p1: PaddleState;
	p2: PaddleState;
	ball: BallState;
}

export interface InputData {
	seq: number;
	dir: number;
}

export interface PlayerInfo {
	ws: WebSocket;
	id: "p1" | "p2";
	dbUserId: string;
	username: string;
}

export interface Room {
	id: string;
	players: PlayerInfo[];
	gameState: GameState;
	inputQueues: { p1: InputData[]; p2: InputData[] };
	loop: NodeJS.Timeout | null;
}

export interface NetworkMessage {
	type: "join_room" | "chat" | "input";
	roomId?: string;
	text?: string;
	seq?: number;
	dir?: number;
	token?: string;
}
