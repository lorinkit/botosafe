import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import crypto from "crypto";

interface ElectionRow extends RowDataPacket {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
}

interface CandidateRow extends RowDataPacket {
  id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
}

interface VoteRow extends RowDataPacket {
  encrypted_vote: string;
}

interface TurnoutRow extends RowDataPacket {
  course: string;
  year_level: string;
  total_voters: number;
  voted: number;
}

interface ResultData {
  candidate_id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
}

interface ResultsResponse {
  election: { id: number; title: string; status: string } | null;
  results: ResultData[];
  turnout: TurnoutRow[];
}

// ✅ Ensure AES_KEY exists and is properly typed
const AES_KEY: string = process.env.AES_KEY ?? "";

if (!AES_KEY) {
  throw new Error("❌ Missing AES_KEY in environment variables.");
}

// 🧩 AES Decryption Helper
function decryptVote(encryptedHex: string): string | null {
  try {
    const data = Buffer.from(encryptedHex, "hex");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const text = data.subarray(28);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(AES_KEY as string, "hex"),
      iv
    );
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("⚠️ Decryption failed:", err);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResultsResponse | { error: string }>
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    // 🔹 Get elections
    const [elections] = await pool.query<ElectionRow[]>(
      "SELECT * FROM elections ORDER BY start_time DESC"
    );

    if (!elections.length) {
      res.status(200).json({ election: null, results: [], turnout: [] });
      return;
    }

    const now = new Date();

    // 🔹 Update election statuses dynamically
    for (const e of elections) {
      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      const status =
        now < start ? "upcoming" : now <= end ? "ongoing" : "closed";
      if (status !== e.status) {
        await pool.query<ResultSetHeader>(
          "UPDATE elections SET status = ? WHERE id = ?",
          [status, e.id]
        );
        e.status = status;
      }
    }

    // 🔹 Get latest relevant election
    const election =
      elections.find((e) => e.status === "ongoing") ||
      elections.find((e) => e.status === "closed");

    if (!election) {
      res.status(200).json({ election: null, results: [], turnout: [] });
      return;
    }

    // 🔹 Fetch all candidates
    const [candidates] = await pool.query<CandidateRow[]>(
      `SELECT 
         c.id,
         p.id AS position_id,
         p.name AS position_name,
         u.fullname AS candidate_name
       FROM candidates c
       JOIN positions p ON p.id = c.position_id
       JOIN users u ON u.id = c.user_id
       WHERE c.election_id = ?`,
      [election.id]
    );

    // 🔹 Fetch all encrypted votes
    const [votes] = await pool.query<VoteRow[]>(
      "SELECT encrypted_vote FROM votes WHERE election_id = ?",
      [election.id]
    );

    // 🔹 Decrypt & Count Votes
    const voteCounts: Record<number, number> = {};

    for (const vote of votes) {
      const decrypted = decryptVote(vote.encrypted_vote);
      if (!decrypted) continue;

      try {
        const parsed = JSON.parse(decrypted) as {
          positionId: string;
          candidateId: string;
        };

        const cid = parseInt(parsed.candidateId, 10);
        if (!isNaN(cid)) {
          voteCounts[cid] = (voteCounts[cid] || 0) + 1;
        }
      } catch (e) {
        console.error("⚠️ Invalid decrypted vote JSON:", e);
      }
    }

    // 🔹 Merge with candidates
    const results: ResultData[] = candidates.map((c) => ({
      candidate_id: c.id,
      position_id: c.position_id,
      position_name: c.position_name,
      candidate_name: c.candidate_name,
      vote_count: voteCounts[c.id] || 0,
    }));

    // 🔹 Fetch turnout
    const [turnout] = await pool.query<TurnoutRow[]>(
      `SELECT 
         u.course,
         u.year_level,
         COUNT(u.id) AS total_voters,
         COUNT(DISTINCT v.user_id) AS voted
       FROM users u
       LEFT JOIN votes v ON u.id = v.user_id AND v.election_id = ?
       WHERE u.role = 'voter'
       GROUP BY u.course, u.year_level
       ORDER BY u.course, u.year_level`,
      [election.id]
    );

    res.status(200).json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
      },
      results,
      turnout,
    });
  } catch (err) {
    console.error("❌ Error fetching results:", err);
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
}
