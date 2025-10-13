// pages/api/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface VerifyOtpSuccessResponse {
  message: string;
  otpVerified: true;
  user: {
    id: number;
    fullname: string;
    email: string;
    role: string;
    hasFace: boolean;
  };
}

interface ErrorResponse {
  message: string;
}

interface OtpRow extends RowDataPacket {
  id: number;
  user_id: number;
  otp: string;
  expires_at: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  role: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyOtpSuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.status(400).json({ message: "userId and otp are required" });
  }

  try {
    // ✅ Verify OTP (MySQL version)
    const [otpRows] = await pool.query<OtpRow[]>(
      `SELECT * FROM user_otps 
       WHERE user_id = ? 
         AND otp = ? 
         AND expires_at > NOW()`,
      [userId, otp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // ✅ Delete OTP after verification
    await pool.query<ResultSetHeader>(
      "DELETE FROM user_otps WHERE user_id = ?",
      [userId]
    );

    // ✅ Get user info
    const [userRows] = await pool.query<UserRow[]>(
      "SELECT id, fullname, email, role FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    // ✅ Check if user has a registered face
    const [faceRows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM user_faces WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const hasFace = faceRows.length > 0;

    return res.status(200).json({
      message: "OTP verified successfully",
      otpVerified: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        hasFace,
      },
    });
  } catch (err: unknown) {
    console.error("❌ Verify OTP Error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return res.status(500).json({ message });
  }
}
