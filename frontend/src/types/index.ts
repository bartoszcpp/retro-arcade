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

export interface StateBufferItem {
	state: GameState;
	time: number;
}

export interface ChatMessage {
	sender: string;
	text: string;
}

export interface User {
	username: string;
	elo: number;
}

export interface AuthResponse {
	message?: string;
	error?: string;
	token?: string;
	user?: User;
	userId?: string;
}

export interface PlayerStats {
	username: string;
	oldElo: number;
	newElo: number;
}

export interface GameStats {
	p1: PlayerStats;
	p2: PlayerStats;
}

export interface ServerMessage {
	type: "init" | "state" | "chat" | "error" | "game_over";
	id?: "p1" | "p2";
	sender?: string;
	text?: string;
	state?: GameState;
	serverTime?: number;
	message?: string;
	stats?: GameStats; // Used for end game results
}

export interface LeaderboardEntry {
	username: string;
	elo: number;
}
