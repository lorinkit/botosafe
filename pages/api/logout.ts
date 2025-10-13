// pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

interface LogoutResponse {
  message?: string;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  res.setHeader(
    "Set-Cookie",
    serialize("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/", // must match the path where token was set
      expires: new Date(0), // immediately expire
    })
  );

  return res.status(200).json({ message: "Logged out successfully" });
}
