import React, { useState } from "react";
import type { ServerMessage, ChatMessage, User } from "./types";
import { Auth } from "./components/Auth";
import { Lobby } from "./components/Lobby";
import { Chat } from "./components/Chat";
import { PongGame } from "./components/PongGame";

export const App = () => {
	// Auth State
	const [token, setToken] = useState<string | null>(null);
	const [currentUser, setCurrentUser] = useState<User | null>(null);

	// Game State
	const [roomId, setRoomId] = useState("");
	const [joined, setJoined] = useState(false);
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState("");
	const [myId, setMyId] = useState<"p1" | "p2" | null>(null);

	const handleLoginSuccess = (jwtToken: string, user: User) => {
		setToken(jwtToken);
		setCurrentUser(user);
	};

	const handleJoin = (e: React.FormEvent) => {
		e.preventDefault();
		// Guard clause: ensure room ID and token exist
		if (!roomId.trim() || !token) return;

		const ws = new WebSocket("ws://localhost:8080");

		ws.onopen = () => {
			// Pass the JWT token to the server for authentication
			ws.send(JSON.stringify({ type: "join_room", roomId, token }));
			setJoined(true);
			setSocket(ws);
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data) as ServerMessage;

			if (data.type === "chat" && data.sender && data.text) {
				setChatMessages((prev) => [
					...prev,
					{ sender: data.sender!, text: data.text! },
				]);
			} else if (data.type === "init" && data.id) {
				setMyId(data.id);
			} else if (data.type === "error" && data.message) {
				// Basic error handling for unauthorized attempts
				alert(`Server error: ${data.message}`);
				setJoined(false);
			}
		};
	};

	const sendChat = (e: React.FormEvent) => {
		e.preventDefault();
		if (socket && chatInput.trim()) {
			socket.send(JSON.stringify({ type: "chat", text: chatInput }));
			setChatInput("");
		}
	};

	// 1. If not logged in, show Auth component
	if (!token || !currentUser) {
		return <Auth onLoginSuccess={handleLoginSuccess} />;
	}

	// 2. If logged in but not in a room, show Lobby
	if (!joined) {
		return (
			<div>
				<div
					style={{
						padding: "10px",
						background: "#333",
						color: "white",
						textAlign: "right",
					}}
				>
					Logged in as: <strong>{currentUser.username}</strong> | ELO:{" "}
					{currentUser.elo}
				</div>
				<Lobby roomId={roomId} setRoomId={setRoomId} handleJoin={handleJoin} />
			</div>
		);
	}

	const handleLeaveRoom = () => {
		if (socket) {
			socket.close();
			setSocket(null);
		}
		setJoined(false);
		setRoomId("");
		setChatMessages([]);
		setMyId(null);
	};

	// 3. If in a room, show the Game and Chat
	return (
		<div>
			<div
				style={{
					padding: "10px",
					background: "#333",
					color: "white",
					textAlign: "right",
				}}
			>
				Logged in as: <strong>{currentUser.username}</strong> | ELO:{" "}
				{currentUser.elo}
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					gap: "20px",
					marginTop: "30px",
					fontFamily: "sans-serif",
				}}
			>
				<div>
					<h3>
						Room: {roomId} {myId ? `(You are: ${myId})` : ""}
					</h3>
					{/* Pass the new handleLeaveRoom function here */}
					{socket && myId && (
						<PongGame socket={socket} myId={myId} onLeaveRoom={handleLeaveRoom} />
					)}
				</div>

				<Chat
					messages={chatMessages}
					input={chatInput}
					setInput={setChatInput}
					handleSend={sendChat}
				/>
			</div>
		</div>
	);
};
