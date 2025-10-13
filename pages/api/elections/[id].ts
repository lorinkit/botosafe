import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface Election extends RowDataPacket {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
  filing_start_time?: string | null;
  filing_end_time?: string | null;
}

function computeStatus(e: Election): string {
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
  res: NextApiResponse<Election | { error: string }>
) {
  const { id } = req.query;

  try {
    if (req.method === "GET") {
      const [rows] = await pool.query<Election[]>(
        "SELECT * FROM elections WHERE id = ?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Election not found" });
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

      return res.status(200).json(election);
    }

    if (req.method === "PUT") {
      const {
        title,
        start_time,
        end_time,
        filing_start_time,
        filing_end_time,
      } = req.body as Partial<Election>;

      await pool.query<ResultSetHeader>(
        `UPDATE elections
         SET title = ?, start_time = ?, end_time = ?, filing_start_time = ?, filing_end_time = ?
         WHERE id = ?`,
        [title, start_time, end_time, filing_start_time, filing_end_time, id]
      );

      const [updatedRows] = await pool.query<Election[]>(
        "SELECT * FROM elections WHERE id = ?",
        [id]
      );

      return res.status(200).json(updatedRows[0]);
    }

    if (req.method === "DELETE") {
      await pool.query<ResultSetHeader>("DELETE FROM elections WHERE id = ?", [
        id,
      ]);
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
