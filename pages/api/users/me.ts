import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    const token = req.cookies.authToken;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      mfa?: boolean;
    };

    if (!decoded.mfa) {
      return res.status(403).json({ message: "Full MFA required" });
    }

    if (req.method === "GET") {
      const [rows] = await pool.query<User[]>(
        `SELECT id, fullname, email, school_id, age, year_level, 
                user_status, approval_status, gender, course
         FROM users WHERE id = ?`,
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({ user: rows[0] });
    }

    if (req.method === "PUT") {
      const {
        fullname,
        email,
        school_id,
        age,
        year_level,
        user_status,
        gender,
        course,
        password,
      } = req.body;

      let hashedPassword: string | null = null;
      if (password?.trim()) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const updateFields = [
        "fullname = ?",
        "email = ?",
        "school_id = ?",
        "age = ?",
        "year_level = ?",
        "user_status = ?",
        "gender = ?",
        "course = ?",
      ];
      const values: (string | number | null)[] = [
        fullname,
        email,
        school_id,
        age,
        year_level,
        user_status,
        gender,
        course,
      ];

      if (hashedPassword) {
        updateFields.push("password = ?");
        values.push(hashedPassword);
      }

      updateFields.push("updated_at = NOW()");
      values.push(decoded.id);

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(", ")}
        WHERE id = ?
      `;

      const [updateResult] = await pool.query<ResultSetHeader>(
        updateQuery,
        values
      );

      if (updateResult.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "User not found or not updated" });
      }

      const [rows] = await pool.query<User[]>(
        `SELECT id, fullname, email, school_id, age, year_level, 
                user_status, approval_status, gender, course
         FROM users WHERE id = ?`,
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found after update" });
      }

      return res.status(200).json({
        message: "User updated successfully",
        user: rows[0],
      });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error("User API error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
