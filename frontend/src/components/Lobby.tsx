import React from "react";

interface LobbyProps {
	roomId: string;
	setRoomId: React.Dispatch<React.SetStateAction<string>>;
	handleJoin: (e: React.FormEvent) => void;
}

export const Lobby = ({ roomId, setRoomId, handleJoin }: LobbyProps) => (
	<div
		style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			marginTop: "100px",
			fontFamily: "sans-serif",
		}}
	>
		<h1>Retro Arcade: PONG</h1>
		<form onSubmit={handleJoin} style={{ display: "flex", gap: "10px" }}>
			<input
				type='text'
				placeholder='Enter Room ID (e.g., room1)'
				value={roomId}
				onChange={(e) => setRoomId(e.target.value)}
				style={{ padding: "10px", fontSize: "16px" }}
			/>
			<button
				type='submit'
				style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
			>
				Join / Create
			</button>
		</form>
	</div>
);
