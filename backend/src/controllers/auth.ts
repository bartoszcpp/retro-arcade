import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

export const register = async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;
		if (!username || !password)
			return res.status(400).json({ error: "Missing fields" });

		const existingUser = await prisma.user.findUnique({ where: { username } });
		if (existingUser) return res.status(409).json({ error: "Username exists" });

		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = await prisma.user.create({
			data: { username, password: hashedPassword },
		});

		return res.status(201).json({ message: "Registered", userId: newUser.id });
	} catch (error) {
		return res.status(500).json({ error: "Internal server error" });
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;
		if (!username || !password)
			return res.status(400).json({ error: "Missing fields" });

		const user = await prisma.user.findUnique({ where: { username } });
		if (!user || !(await bcrypt.compare(password, user.password))) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const token = jwt.sign(
			{ userId: user.id, username: user.username },
			JWT_SECRET,
			{ expiresIn: "24h" },
		);
		return res
			.status(200)
			.json({
				message: "Login successful",
				token,
				user: { username: user.username, elo: user.elo },
			});
	} catch (error) {
		return res.status(500).json({ error: "Internal server error" });
	}
};

export const getLeaderboard = async (req: Request, res: Response) => {
	try {
		const topPlayers = await prisma.user.findMany({
			select: { username: true, elo: true },
			orderBy: { elo: "desc" },
			take: 10,
		});
		return res.status(200).json(topPlayers);
	} catch (error) {
		return res.status(500).json({ error: "Internal server error" });
	}
};
