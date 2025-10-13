import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface Position extends RowDataPacket {
  id: number;
  election_id: number;
  name: string;
  election_title?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position | Position[] | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const [rows] = await pool.query<Position[]>(
        `SELECT p.*, e.title AS election_title
         FROM positions p
         JOIN elections e ON p.election_id = e.id
         ORDER BY p.id DESC`
      );
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const { election_id, name } = req.body;

      // Insert into MySQL
      const [insertResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO positions (election_id, name) VALUES (?, ?)`,
        [election_id, name]
      );

      const insertId = insertResult.insertId;

      // Fetch the newly created record
      const [rows] = await pool.query<Position[]>(
        `SELECT p.*, e.title AS election_title
         FROM positions p
         JOIN elections e ON p.election_id = e.id
         WHERE p.id = ?`,
        [insertId]
      );

      if (rows.length === 0) {
        return res
          .status(500)
          .json({ error: "Failed to fetch created position" });
      }

      return res.status(201).json(rows[0]);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error("❌ Positions API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
