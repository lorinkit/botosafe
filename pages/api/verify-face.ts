import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import jwt from "jsonwebtoken";
import { serialize } from "cookie";
import { RowDataPacket } from "mysql2";

// ------------------- UTILITY -------------------
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function toNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) return input.map(Number);
  if (input instanceof Float32Array) return Array.from(input);
  throw new Error("Invalid embedding format");
}

function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / (norm || 1));
}

const THRESHOLD = 0.9;

interface FaceRow extends RowDataPacket {
  user_id: number;
  face_embedding: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  role: string;
}

// ------------------- HANDLER -------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    const { userId, embedding, forVoting } = req.body as {
      userId: number;
      embedding: number[] | Float32Array;
      forVoting?: boolean;
    };

    if (!userId || !embedding)
      return res.status(400).json({ message: "Missing userId or embedding" });

    const embeddingArray = toNumberArray(embedding);
    const normalized = normalizeEmbedding(embeddingArray);

    const [faceRows] = await pool.query<FaceRow[]>(
      "SELECT user_id, face_embedding FROM user_faces WHERE user_id = ?",
      [userId]
    );

    if (faceRows.length === 0) {
      return res
        .status(200)
        .json({ match: false, message: "No face registered" });
    }

    const storedEmbedding = toNumberArray(
      JSON.parse(faceRows[0].face_embedding)
    );
    const normalizedStored = normalizeEmbedding(storedEmbedding);
    const sim = cosineSimilarity(normalized, normalizedStored);

    if (sim < THRESHOLD) {
      return res
        .status(200)
        .json({ match: false, message: "Face not recognized" });
    }

    const [userRows] = await pool.query<UserRow[]>(
      "SELECT id, fullname, email, role FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0)
      return res.status(404).json({ message: "User not found" });
    const user = userRows[0];

    if (forVoting) {
      // 🔐 Issue short-lived vote token (valid for 5 min)
      const voteToken = jwt.sign(
        { id: user.id, electionId: req.body.electionId },
        process.env.JWT_SECRET!,
        { expiresIn: "5m" }
      );
      return res.status(200).json({
        match: true,
        user,
        voteToken,
        message: "Face verified for voting.",
      });
    } else {
      // 🔐 Issue regular login token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa: true },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );

      res.setHeader(
        "Set-Cookie",
        serialize("authToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60,
        })
      );

      return res
        .status(200)
        .json({ match: true, user, message: "Face verified. User logged in." });
    }
  } catch (err) {
    console.error("❌ Face verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
