import React, { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../types";

interface LobbyProps {
	roomId: string;
	setRoomId: React.Dispatch<React.SetStateAction<string>>;
	handleJoin: (e: React.FormEvent) => void;
}

export const Lobby = ({ roomId, setRoomId, handleJoin }: LobbyProps) => {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchLeaderboard = async () => {
			try {
				const response = await fetch("http://localhost:8080/api/leaderboard");
				if (!response.ok) throw new Error("Failed to fetch leaderboard");
				const data = (await response.json()) as LeaderboardEntry[];
				setLeaderboard(data);
			} catch (error) {
				console.error(error);
			} finally {
				setLoading(false);
			}
		};

		fetchLeaderboard();
	}, []);

	return (
		<div className='flex flex-col items-center mt-16 font-arcade text-white crt'>
			<h1 className='text-4xl text-neon-green mb-16 drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]'>
				PONG: MULTIPLAYER
			</h1>

			<div className='flex flex-col xl:flex-row gap-16 items-start relative z-10'>
				{/* ROOM CONNECTION SECTION */}
				<div className='flex flex-col items-center bg-black p-8 border-4 border-gray-700 shadow-[0_0_20px_rgba(57,255,20,0.1)]'>
					<h2 className='text-xl text-neon-blue mb-8 uppercase drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]'>
						Join Match
					</h2>
					<form onSubmit={handleJoin} className='flex flex-col gap-6 items-center'>
						<input
							type='text'
							placeholder='ENTER ROOM ID'
							value={roomId}
							onChange={(e) => setRoomId(e.target.value)}
							className='p-4 w-72 bg-gray-900 border-2 border-gray-600 text-white text-xs outline-none focus:border-neon-green focus:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all uppercase text-center'
						/>
						<button
							type='submit'
							className='w-full p-4 border-2 border-neon-green bg-transparent text-neon-green hover:bg-neon-green hover:text-black hover:shadow-[0_0_20px_rgba(57,255,20,0.8)] transition-all uppercase text-xs cursor-pointer font-bold'
						>
							JOIN / CREATE
						</button>
					</form>
					<div className='mt-8 text-gray-500 text-[10px] text-center leading-relaxed uppercase'>
						<p>Tip: Share the Room ID</p>
						<p className='mt-2'>to start playing.</p>
					</div>
				</div>

				{/* LEADERBOARD SECTION */}
				<div className='flex flex-col items-center bg-black p-8 border-4 border-gray-700 shadow-[0_0_20px_rgba(255,0,255,0.1)] w-80'>
					<h2 className='text-xl text-neon-pink mb-8 uppercase drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]'>
						Hall of Fame
					</h2>

					{loading ? (
						<p className='text-xs text-gray-400 animate-pulse uppercase'>
							Loading Ranks...
						</p>
					) : (
						<ul className='w-full flex flex-col gap-4 m-0 p-0 list-none'>
							{leaderboard.map((player, index) => (
								<li
									key={index}
									className={`flex justify-between text-xs p-2 border-b border-gray-800 ${
										index === 0
											? "text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]"
											: index === 1
												? "text-gray-300"
												: index === 2
													? "text-amber-600"
													: "text-white"
									}`}
								>
									<span>
										{index + 1}. {player.username}
									</span>
									<span>{player.elo}</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
};
