// pages/api/candidates/approved.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface Achievement {
  id: number;
  title: string;
  type: string;
  created_at: string;
}

interface Candidate extends RowDataPacket {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: string; // Raw string (JSON-like) from MariaDB
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface ApprovedCandidate {
  id: number;
  user_id: number;
  fullname: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: Achievement[];
  photo_url?: string;
  partylist?: string;
  coc_file_url?: string;
  status: string;
  created_at: string;
}

interface ApprovedResponse {
  candidates: ApprovedCandidate[];
  groupedByPosition: Record<string, ApprovedCandidate[]>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApprovedResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // ✅ MariaDB-compatible JSON aggregation using GROUP_CONCAT
    const [rows] = await pool.query<Candidate[]>(
      `SELECT 
         c.id,
         c.user_id,
         u.fullname,
         c.election_id,
         e.title AS election_title,
         c.position_id,
         p.name AS position_name,
         COALESCE(
           CONCAT(
             '[',
             GROUP_CONCAT(
               CONCAT(
                 '{"id":', ca.id,
                 ',"title":"', IFNULL(ca.title, ''), '"',
                 ',"type":"', IFNULL(ca.type, ''), '"',
                 ',"created_at":"', IFNULL(ca.created_at, ''), '"}'
               )
             ),
             ']'
           ),
           '[]'
         ) AS achievements,
         c.photo_url,
         c.partylist,
         c.coc_file_url,
         c.status,
         c.created_at
       FROM candidates c
       JOIN users u ON c.user_id = u.id
       JOIN elections e ON c.election_id = e.id
       JOIN positions p ON c.position_id = p.id
       LEFT JOIN candidate_achievements ca ON ca.candidate_id = c.id
       WHERE c.status = 'approved'
         AND u.approval_status = 'approved'
         AND u.user_status = 'active'
       GROUP BY c.id, u.fullname, e.title, p.id, p.name
       ORDER BY p.id, u.fullname ASC`
    );

    // ✅ Parse JSON achievements safely
    const candidates: ApprovedCandidate[] = rows.map((row) => {
      let achievements: Achievement[] = [];
      try {
        achievements = JSON.parse(row.achievements || "[]");
      } catch {
        achievements = [];
      }
      return { ...row, achievements };
    });

    // ✅ Group candidates by position
    const groupedByPosition: Record<string, ApprovedCandidate[]> = {};
    for (const candidate of candidates) {
      if (!groupedByPosition[candidate.position_name]) {
        groupedByPosition[candidate.position_name] = [];
      }
      groupedByPosition[candidate.position_name].push(candidate);
    }

    return res.status(200).json({ candidates, groupedByPosition });
  } catch (error) {
    console.error("❌ API Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
