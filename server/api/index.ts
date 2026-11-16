import type { Request, Response } from "express";
import { app } from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
let connection: Promise<void> | undefined;
export default async function handler(req: Request, res: Response) {
 try {connection ??= connectDatabase().catch(error => {connection = undefined; throw error;}); await connection; app(req, res);}
 catch {res.status(503).json({error: {code: "DATABASE_UNAVAILABLE", message: "Database unavailable"}});}
}
