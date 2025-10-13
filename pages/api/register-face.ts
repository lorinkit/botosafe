import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// ------------------- UTILITY -------------------
function normalizeEmbedding(embedding: number[] | Float32Array): number[] {
  const arr = Array.from(embedding);
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? arr : arr.map((val) => val / norm);
}

interface FaceRow extends RowDataPacket {
  id: number;
  user_id: number;
  face_embedding: string;
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    const { userId, embedding } = req.body as {
      userId: number;
      embedding: number[] | Float32Array;
    };

    if (!userId || !embedding) {
      res.status(400).json({ message: "Missing userId or embedding" });
      return;
    }

    const normalized = normalizeEmbedding(embedding);

    // Check if user already has a face entry
    const [existingRows] = await pool.query<FaceRow[]>(
      "SELECT * FROM user_faces WHERE user_id = ?",
      [userId]
    );

    if (existingRows.length > 0) {
      // Update existing record
      await pool.query<ResultSetHeader>(
        "UPDATE user_faces SET face_embedding = ? WHERE user_id = ?",
        [JSON.stringify(normalized), userId]
      );
      res.status(200).json({ message: "updated" });
      return;
    }

    // Insert new record
    await pool.query<ResultSetHeader>(
      "INSERT INTO user_faces (user_id, face_embedding) VALUES (?, ?)",
      [userId, JSON.stringify(normalized)]
    );

    res.status(200).json({ message: "success" });
  } catch (err) {
    console.error("Register face error:", err);
    res.status(500).json({ message: "Server error" });
  }
}
