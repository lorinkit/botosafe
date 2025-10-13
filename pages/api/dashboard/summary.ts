import type { NextApiRequest, NextApiResponse } from "next";
import { pool } from "@/configs/database";
import { RowDataPacket } from "mysql2";

interface Election extends RowDataPacket {
  id: number;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
  timeRemaining?: string | null;
}

interface CourseVotersRow extends RowDataPacket {
  course: string;
  year_level: number;
  voters: number;
}

interface CourseTurnoutRow extends RowDataPacket {
  course: string;
  year_level: number;
  turnout: number;
}

interface CourseTurnout {
  course: string;
  year_level: number;
  label: string;
  voters: number;
  turnout: number;
}

interface SummaryResponse {
  voters: number;
  candidates: number;
  voted: number;
  election: Election | null;
  courses: CourseTurnout[];
}

const ALLOWED_COURSES = [
  "BSCS",
  "ACT",
  "BSED English",
  "BSED Science",
  "BEED",
  "BSCrim",
  "BSSW",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryResponse | { error: string }>
): Promise<void> {
  try {
    // 🗳 Get latest election
    const [electionRows] = await pool.query<Election[]>(
      `SELECT id, title, status, start_time, end_time
       FROM elections
       WHERE status IN ('upcoming', 'filing', 'ongoing', 'closed')
       ORDER BY start_time DESC
       LIMIT 1`
    );

    const election = electionRows[0] || null;

    if (!election) {
      return res.status(200).json({
        voters: 0,
        candidates: 0,
        voted: 0,
        election: null,
        courses: [],
      });
    }

    // 👥 Total active and approved voters
    const [votersRows] = await pool.query<
      (RowDataPacket & { total: number })[]
    >(
      `SELECT COUNT(*) AS total 
       FROM users 
       WHERE role = 'voter' 
         AND approval_status = 'approved' 
         AND user_status = 'active'`
    );
    const voters = votersRows[0]?.total ?? 0;

    // 👤 Total candidates in current election
    const [candidatesRows] = await pool.query<
      (RowDataPacket & { total: number })[]
    >(
      `SELECT COUNT(*) AS total 
       FROM candidates 
       WHERE election_id = ?`,
      [election.id]
    );
    const candidates = candidatesRows[0]?.total ?? 0;

    // ✅ Total unique users who voted in this election
    const [votedRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(DISTINCT v.user_id) AS total
       FROM votes v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN candidates c ON v.candidate_id = c.id
       WHERE u.role = 'voter'
         AND u.approval_status = 'approved'
         AND u.user_status = 'active'
         AND (c.election_id = ? OR v.election_id = ? OR c.election_id IS NULL)`,
      [election.id, election.id]
    );
    const voted = votedRows[0]?.total ?? 0;

    // 🎓 Registered voters per course/year
    const [votersByCourseRows] = await pool.query<CourseVotersRow[]>(
      `SELECT course, year_level, COUNT(*) AS voters
       FROM users
       WHERE role = 'voter'
         AND approval_status = 'approved'
         AND user_status = 'active'
         AND course IN (${ALLOWED_COURSES.map(() => "?").join(",")})
       GROUP BY course, year_level
       ORDER BY course, year_level`,
      ALLOWED_COURSES
    );

    // 🎓 Actual turnout (voted users) per course/year
    const [turnoutByCourseRows] = await pool.query<CourseTurnoutRow[]>(
      `SELECT 
         u.course, 
         u.year_level, 
         COUNT(DISTINCT u.id) AS turnout
       FROM users u
       LEFT JOIN votes v ON u.id = v.user_id
       LEFT JOIN candidates c ON v.candidate_id = c.id
       WHERE u.role = 'voter'
         AND u.approval_status = 'approved'
         AND u.user_status = 'active'
         AND u.course IN (${ALLOWED_COURSES.map(() => "?").join(",")})
         AND (c.election_id = ? OR v.election_id = ? OR c.election_id IS NULL)
       GROUP BY u.course, u.year_level
       ORDER BY u.course, u.year_level`,
      [...ALLOWED_COURSES, election.id, election.id]
    );

    // 🧩 Create a turnout map
    const turnoutMap = turnoutByCourseRows.reduce<Record<string, number>>(
      (acc, row) => {
        acc[`${row.course}_${row.year_level}`] = row.turnout;
        return acc;
      },
      {}
    );

    // 🧩 Combine voter + turnout data
    const courses: CourseTurnout[] = votersByCourseRows.map((row) => ({
      course: row.course,
      year_level: row.year_level,
      label: `${row.course} - Year ${row.year_level}`,
      voters: row.voters,
      turnout: turnoutMap[`${row.course}_${row.year_level}`] ?? 0,
    }));

    // ⏳ Compute remaining time
    let timeRemaining: string | null = null;
    const now = Date.now();
    const startMs = new Date(election.start_time).getTime();
    const endMs = new Date(election.end_time).getTime();

    if (now < startMs) {
      const diff = startMs - now;
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `Starts in ${hrs}h ${mins}m`;
    } else if (now < endMs) {
      const diff = endMs - now;
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `${hrs}h ${mins}m remaining`;
    } else {
      timeRemaining = "Ended";
    }

    // ✅ Final response
    return res.status(200).json({
      voters,
      candidates,
      voted,
      election: { ...election, timeRemaining },
      courses,
    });
  } catch (err: unknown) {
    console.error("❌ Error loading admin summary:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
