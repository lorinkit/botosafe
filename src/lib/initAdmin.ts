import { pool } from "@/configs/database";
import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  fullname: string;
  password: string;
  role: "admin" | "voter";
  is_verified: boolean;
}

export async function ensureAdminExists() {
  try {
    const email = process.env.ADMIN_EMAIL!;
    const plainPassword = process.env.ADMIN_PASSWORD!;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const [rows] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO users 
          (fullname, age, gender, course, year_level, school_id, password, email, is_verified, role) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Default Admin",
          30,
          "male",
          "Administration",
          "N/A",
          "0000",
          hashedPassword,
          email,
          true,
          "admin",
        ]
      );

      console.log("✅ Admin created successfully");
    } else {
      console.log("ℹ️ Admin already exists, skipping insert");
    }
  } catch (error) {
    console.error("❌ Error ensuring admin exists:", error);
  }
}
