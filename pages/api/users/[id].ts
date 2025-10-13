import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface User extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  school_id?: string | null;
  age?: number | null;
  year_level?: number | null;
  user_status?: string | null;
  approval_status?: string | null;
  gender?: string | null;
  course?: string | null;
}

interface ApiResponse {
  message?: string;
  user?: User;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const {
    query: { id },
    method,
  } = req;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    switch (method) {
      case "GET": {
        const [rows] = await pool.query<User[]>(
          `SELECT id, fullname, email, school_id, age, year_level, 
                  user_status, approval_status, gender, course 
           FROM users WHERE id = ?`,
          [id]
        );

        if (rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ user: rows[0] });
      }

      case "PUT": {
        const fields = req.body;

        const keys = Object.keys(fields);
        if (keys.length === 0)
          return res.status(400).json({ error: "No fields provided" });

        const setClause = keys.map((key) => `${key} = ?`).join(", ");
        const values = Object.values(fields);

        const [updateResult] = await pool.query<ResultSetHeader>(
          `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
          [...values, id]
        );

        if (updateResult.affectedRows === 0) {
          return res
            .status(404)
            .json({ error: "User not found or not updated" });
        }

        const [rows] = await pool.query<User[]>(
          `SELECT id, fullname, email, school_id, age, year_level, 
                  user_status, approval_status, gender, course 
           FROM users WHERE id = ?`,
          [id]
        );

        if (rows.length === 0) {
          return res.status(404).json({ error: "User not found after update" });
        }

        return res.status(200).json({
          message: "User updated successfully",
          user: rows[0],
        });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT"]);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (err: unknown) {
    console.error("Error in /api/users/[id]:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ error: message });
  }
}
