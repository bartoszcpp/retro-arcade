import React, { useState } from "react";
import type { User, AuthResponse } from "../types";

interface AuthProps {
	onLoginSuccess: (token: string, user: User) => void;
}

export const Auth = ({ onLoginSuccess }: AuthProps) => {
	const [isLoginMode, setIsLoginMode] = useState(true);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [errorMsg, setErrorMsg] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMsg("");
		setLoading(true);

		const endpoint = isLoginMode ? "/api/login" : "/api/register";

		try {
			const response = await fetch(`http://localhost:8080${endpoint}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ username, password }),
			});

			const data = (await response.json()) as AuthResponse;

			if (!response.ok) {
				throw new Error(data.error || "Something went wrong");
			}

			if (isLoginMode && data.token && data.user) {
				onLoginSuccess(data.token, data.user);
			} else {
				// Registration successful, automatically switch to login mode
				setIsLoginMode(true);
				setErrorMsg("Registration successful! You can now log in.");
				setUsername("");
				setPassword("");
			}
		} catch (error: any) {
			setErrorMsg(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
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
			<h2>{isLoginMode ? "Sign In" : "Create Account"}</h2>

			<form
				onSubmit={handleSubmit}
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "10px",
					width: "300px",
					padding: "20px",
					border: "1px solid #ccc",
					borderRadius: "8px",
					backgroundColor: "#f9f9f9",
				}}
			>
				<input
					type='text'
					placeholder='Username'
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					required
					style={{ padding: "10px", fontSize: "16px" }}
				/>
				<input
					type='password'
					placeholder='Password'
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					style={{ padding: "10px", fontSize: "16px" }}
				/>

				{errorMsg && (
					<div
						style={{
							color: errorMsg.includes("successful") ? "green" : "red",
							fontSize: "14px",
							textAlign: "center",
						}}
					>
						{errorMsg}
					</div>
				)}

				<button
					type='submit'
					disabled={loading}
					style={{
						padding: "10px",
						fontSize: "16px",
						cursor: "pointer",
						marginTop: "10px",
					}}
				>
					{loading ? "Processing..." : isLoginMode ? "Login" : "Register"}
				</button>

				<button
					type='button'
					onClick={() => {
						setIsLoginMode(!isLoginMode);
						setErrorMsg("");
					}}
					style={{
						background: "none",
						border: "none",
						color: "blue",
						textDecoration: "underline",
						cursor: "pointer",
						marginTop: "10px",
					}}
				>
					{isLoginMode ? "Need an account? Register" : "Have an account? Login"}
				</button>
			</form>
		</div>
	);
};
