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
				setIsLoginMode(true);
				setErrorMsg("Registration successful! Insert coin to login.");
				setUsername("");
				setPassword("");
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				setErrorMsg(error.message);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='flex flex-col items-center justify-center min-h-screen font-arcade crt text-white bg-[#050505]'>
			<h1 className='text-4xl text-neon-blue mb-8 text-center leading-relaxed drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]'>
				RETRO ARCADE
			</h1>
			<h2 className='text-2xl text-neon-pink mb-10'>
				{isLoginMode ? "INSERT COIN" : "NEW CHALLENGER"}
			</h2>

			<form
				onSubmit={handleSubmit}
				className='flex flex-col gap-6 w-[450px] p-10 bg-black border-4 border-gray-700 shadow-[0_0_20px_rgba(255,0,255,0.15)] relative z-10'
			>
				<input
					type='text'
					placeholder='USERNAME'
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					required
					className='p-4 bg-gray-900 border-2 border-gray-600 text-white outline-none focus:border-neon-blue focus:shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all uppercase text-xs'
				/>
				<input
					type='password'
					placeholder='PASSWORD'
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className='p-4 bg-gray-900 border-2 border-gray-600 text-white outline-none focus:border-neon-blue focus:shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all uppercase text-xs'
				/>

				{errorMsg && (
					<div
						className={`text-xs text-center leading-relaxed ${errorMsg.includes("successful") ? "text-neon-green drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]" : "text-red-500"}`}
					>
						{errorMsg}
					</div>
				)}

				<button
					type='submit'
					disabled={loading}
					className='mt-6 p-4 bg-neon-pink text-black hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.8)] transition-all uppercase text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
				>
					{loading ? "PROCESSING..." : isLoginMode ? "START (LOGIN)" : "REGISTER"}
				</button>

				<button
					type='button'
					onClick={() => {
						setIsLoginMode(!isLoginMode);
						setErrorMsg("");
					}}
					className='bg-transparent border-none text-gray-500 hover:text-neon-blue text-[10px] uppercase cursor-pointer mt-4 transition-colors'
				>
					{isLoginMode ? "NO ACCOUNT? REGISTER HERE" : "HAVE AN ACCOUNT? LOGIN"}
				</button>
			</form>
		</div>
	);
};
