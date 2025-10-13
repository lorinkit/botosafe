import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface HasVotedResponse {
  hasVoted: boolean;
}

interface HasVotedRow extends RowDataPacket {
  has_voted: number; // MySQL returns TINYINT(1) for booleans
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HasVotedResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { userId, electionId } = req.query;

  if (
    !userId ||
    !electionId ||
    Array.isArray(userId) ||
    Array.isArray(electionId)
  ) {
    return res
      .status(400)
      .json({ error: "Invalid or missing userId or electionId" });
  }

  try {
    const [rows] = await pool.query<HasVotedRow[]>(
      `SELECT COUNT(*) > 0 AS has_voted
       FROM votes
       WHERE user_id = ? AND election_id = ?`,
      [userId, electionId]
    );

    // MySQL will return 0 or 1, not true/false
    const hasVoted = rows.length > 0 ? rows[0].has_voted === 1 : false;

    return res.status(200).json({ hasVoted });
  } catch (err: unknown) {
    console.error("❌ API Error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return res.status(500).json({ error: message });
  }
}
