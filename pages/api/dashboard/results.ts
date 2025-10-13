import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface ResultRow extends RowDataPacket {
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResultRow[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const [rows] = await pool.query<ResultRow[]>(
      `
      SELECT 
        p.id AS position_id,
        p.name AS position_name,
        u.fullname AS candidate_name,
        COUNT(v.id) AS vote_count
      FROM positions p
      JOIN candidates c ON c.position_id = p.id
      JOIN users u ON u.id = c.user_id
      LEFT JOIN votes v ON v.candidate_id = c.id
      WHERE c.election_id = (
        SELECT e.id
        FROM elections e
        WHERE e.status IN ('ongoing', 'closed')
        ORDER BY e.end_time DESC
        LIMIT 1
      )
      GROUP BY p.id, p.name, u.fullname
      ORDER BY p.id, vote_count DESC
      `
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Error fetching results:", error);
    res.status(500).json({ error: (error as Error).message });
  }
}
