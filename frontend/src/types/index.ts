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

export interface ServerMessage {
	type: "init" | "state" | "chat" | "error";
	id?: "p1" | "p2";
	sender?: string;
	text?: string;
	state?: GameState;
	serverTime?: number;
	message?: string;
}

export interface ChatMessage {
	sender: string;
	text: string;
}
