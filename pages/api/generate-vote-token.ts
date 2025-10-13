// pages/api/generate-vote-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { userId, electionId } = req.body;
    if (!userId || !electionId) {
      return res.status(400).json({ error: "Missing user or election ID" });
    }

    const token = jwt.sign(
      { id: userId, electionId },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" } // ⏳ short-lived
    );

    return res.status(200).json({ voteToken: token });
  } catch (err) {
    console.error("Error generating vote token:", err);
    return res.status(500).json({ error: "Failed to generate vote token" });
  }
}
