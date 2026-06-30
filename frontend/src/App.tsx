import React, { useState } from "react";
import type { ServerMessage, ChatMessage } from "./types";
import { Lobby } from "./components/Lobby";
import { Chat } from "./components/Chat";
import { PongGame } from "./components/PongGame";

export const App = () => {
	const [roomId, setRoomId] = useState("");
	const [joined, setJoined] = useState(false);
	const [socket, setSocket] = useState<WebSocket | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState("");
	const [myId, setMyId] = useState<"p1" | "p2" | null>(null);

	const handleJoin = (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomId.trim()) return;

		const ws = new WebSocket("ws://localhost:8080");

		ws.onopen = () => {
			ws.send(JSON.stringify({ type: "join_room", roomId }));
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

	if (!joined) {
		return (
			<Lobby roomId={roomId} setRoomId={setRoomId} handleJoin={handleJoin} />
		);
	}

	return (
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
				{socket && myId && <PongGame socket={socket} myId={myId} />}
			</div>

			<Chat
				messages={chatMessages}
				input={chatInput}
				setInput={setChatInput}
				handleSend={sendChat}
			/>
		</div>
	);
};
