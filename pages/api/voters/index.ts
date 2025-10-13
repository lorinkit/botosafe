import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface Voter extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
  updated_at?: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Voter[] | { message: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const [rows] = await pool.query<Voter[]>(
      "SELECT * FROM users ORDER BY id ASC"
    );

    return res.status(200).json(rows);
  } catch (err: unknown) {
    console.error("Error fetching voters:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ message });
  }
}
