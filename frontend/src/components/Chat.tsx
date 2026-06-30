import React from "react";
import type { ChatMessage } from "../types";

interface ChatProps {
	messages: ChatMessage[];
	input: string;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	handleSend: (e: React.FormEvent) => void;
}

export const Chat = ({ messages, input, setInput, handleSend }: ChatProps) => (
	<div
		style={{
			width: "300px",
			display: "flex",
			flexDirection: "column",
			border: "1px solid #ccc",
			borderRadius: "5px",
		}}
	>
		<h3
			style={{
				margin: "0",
				padding: "10px",
				background: "#eee",
				borderBottom: "1px solid #ccc",
			}}
		>
			Room Chat
		</h3>
		<div
			style={{
				flex: 1,
				height: "510px",
				overflowY: "auto",
				padding: "10px",
				display: "flex",
				flexDirection: "column",
				gap: "5px",
			}}
		>
			{messages.map((msg, i) => (
				<div key={i} style={{ fontSize: "14px" }}>
					<strong>{msg.sender}:</strong> {msg.text}
				</div>
			))}
		</div>
		<form
			onSubmit={handleSend}
			style={{ display: "flex", borderTop: "1px solid #ccc" }}
		>
			<input
				type='text'
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder='Type a message...'
				style={{ flex: 1, padding: "10px", border: "none", outline: "none" }}
			/>
			<button type='submit' style={{ padding: "10px", cursor: "pointer" }}>
				Send
			</button>
		</form>
	</div>
);
