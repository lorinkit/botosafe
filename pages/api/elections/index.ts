import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface Election extends RowDataPacket {
  id: number;
  title: string;
  status: "upcoming" | "filing" | "ongoing" | "closed";
  start_time: string;
  end_time: string;
  filing_start_time?: string | null;
  filing_end_time?: string | null;
  created_at: string;
}

function computeStatus(e: Election): Election["status"] {
  const now = new Date();
  const filingStart = e.filing_start_time
    ? new Date(e.filing_start_time)
    : null;
  const filingEnd = e.filing_end_time ? new Date(e.filing_end_time) : null;
  const start = new Date(e.start_time);
  const end = new Date(e.end_time);

  if (filingStart && now >= filingStart && filingEnd && now <= filingEnd)
    return "filing";
  if (now >= start && now <= end) return "ongoing";
  if (now > end) return "closed";
  return "upcoming";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Election | Election[] | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const [rows] = await pool.query<Election[]>(
        "SELECT * FROM elections ORDER BY created_at DESC"
      );

      const elections = await Promise.all(
        rows.map(async (e) => {
          const newStatus = computeStatus(e);
          if (newStatus !== e.status) {
            await pool.query<ResultSetHeader>(
              "UPDATE elections SET status = ? WHERE id = ?",
              [newStatus, e.id]
            );
            e.status = newStatus;
          }
          return e;
        })
      );

      return res.status(200).json(elections);
    }

    if (req.method === "POST") {
      const {
        title,
        start_time,
        end_time,
        filing_start_time,
        filing_end_time,
      } = req.body;

      // Insert new election
      const [insertResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO elections (
          title, start_time, end_time, filing_start_time, filing_end_time, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          title,
          start_time,
          end_time,
          filing_start_time,
          filing_end_time,
          "upcoming",
        ]
      );

      const insertId = insertResult.insertId;

      // Fetch the inserted election
      const [rows] = await pool.query<Election[]>(
        "SELECT * FROM elections WHERE id = ?",
        [insertId]
      );

      if (rows.length === 0) {
        return res
          .status(500)
          .json({ error: "Failed to fetch created election" });
      }

      const election = rows[0];
      const newStatus = computeStatus(election);

      if (newStatus !== election.status) {
        await pool.query<ResultSetHeader>(
          "UPDATE elections SET status = ? WHERE id = ?",
          [newStatus, election.id]
        );
        election.status = newStatus;
      }

      return res.status(201).json(election);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error("❌ Election API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
