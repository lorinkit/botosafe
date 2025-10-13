// pages/api/send-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import transporter from "@/lib/nodemailer";
import crypto from "crypto";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message?: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // 🔍 Check user existence
    const [userRows] = await pool.query<UserRow[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRows[0].id;
    const otp = crypto.randomInt(100000, 999999).toString();

    // ⏱️ Save OTP with 5-min expiry
    await pool.query<ResultSetHeader>(
      `INSERT INTO user_otps (user_id, otp, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), NOW())
       ON DUPLICATE KEY UPDATE 
         otp = VALUES(otp), 
         expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
         created_at = NOW()`,
      [userId, otp]
    );

    // 📧 Send OTP email
    await transporter.sendMail({
      from: `"BotoSafe" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      html: `<p>Your OTP code is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
    });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err: unknown) {
    console.error("❌ Send OTP Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}
