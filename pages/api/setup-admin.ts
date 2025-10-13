// pages/api/setup-admin.ts
import { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const email = process.env.ADMIN_EMAIL;
    if (!email) {
      return res.status(400).json({ message: "Admin email not set" });
    }

    // 🔍 Check if admin exists
    const [check] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (check.length === 0) {
      // Insert default admin
      await pool.query<ResultSetHeader>(
        "INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)",
        ["System Admin", email, "ENV_ADMIN", "admin"]
      );
      return res.status(200).json({ message: "Default admin inserted" });
    }

    return res.status(200).json({ message: "Admin already exists" });
  } catch (error) {
    console.error("Setup Admin Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
