import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import bcrypt from "bcryptjs";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  role: string;
  approval_status: string;
  user_status: string;
  is_verified: boolean;
  created_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const {
    fullname,
    age,
    gender,
    course,
    year_level,
    school_id,
    email,
    password,
  } = req.body;

  if (
    !fullname ||
    !age ||
    !gender ||
    !course ||
    !year_level ||
    !school_id ||
    !email ||
    !password
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const [existingEmail] = await pool.query<UserRow[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const [existingSchoolId] = await pool.query<UserRow[]>(
      "SELECT id FROM users WHERE school_id = ?",
      [school_id]
    );
    if (existingSchoolId.length > 0) {
      return res.status(400).json({ message: "School ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users 
        (fullname, age, gender, course, year_level, school_id, email, password, role, 
         approval_status, user_status, is_verified, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        fullname,
        age,
        gender,
        course,
        year_level,
        school_id,
        email,
        hashedPassword,
        "voter",
        "pending", // waiting for admin approval
        "active", // default activity status
        false,
      ]
    );

    const newUserId = result.insertId;

    const [newUserRows] = await pool.query<UserRow[]>(
      `SELECT id, fullname, email, role, approval_status, user_status, is_verified, created_at 
       FROM users WHERE id = ?`,
      [newUserId]
    );

    return res.status(201).json({
      message: "Account created successfully. Awaiting admin approval.",
      user: newUserRows[0],
    });
  } catch (error: unknown) {
    console.error("❌ Error creating account:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}
