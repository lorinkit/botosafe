"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";

type Election = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: "upcoming" | "filing" | "ongoing" | "closed";
};

const Home: React.FC = () => {
  const [election, setElection] = useState<Election | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Fetch latest election
  useEffect(() => {
    const fetchElection = async () => {
      try {
        const res = await fetch("/api/elections/latest");
        if (res.ok) {
          const data = await res.json();
          setElection(data);
        }
      } catch (err) {
        console.error("Error fetching election:", err);
      }
    };
    fetchElection();
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!election) return;

    const start = new Date(election.start_time).getTime();
    const end = new Date(election.end_time).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      if (now < start) {
        setTimeLeft(Math.floor((start - now) / 1000));
      } else if (now >= start && now <= end) {
        setTimeLeft(Math.floor((end - now) / 1000));
      } else {
        setTimeLeft(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [election]);

  // Check if user has voted
  useEffect(() => {
    if (!election || election.status !== "ongoing") return;

    const checkVoteStatus = async () => {
      try {
        const res = await fetch(`/api/has-voted?electionId=${election.id}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setHasVoted(data.hasVoted);
        }
      } catch (err) {
        console.error("Error checking vote status:", err);
      }
    };

    checkVoteStatus();
  }, [election]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--:--";
    if (seconds <= 0) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}h : ${mins
      .toString()
      .padStart(2, "0")}m : ${secs.toString().padStart(2, "0")}s`;
  };

  const now = Date.now();
  const start = election ? new Date(election.start_time).getTime() : 0;
  const end = election ? new Date(election.end_time).getTime() : 0;

  let phase: "before" | "ongoing" | "ended" = "before";
  if (now >= start && now <= end) {
    phase = "ongoing";
  } else if (now > end) {
    phase = "ended";
  }

  return (
    <MainLayout>
      <div
        className="min-h-screen flex flex-col items-center justify-center
        bg-gradient-to-br from-white via-purple-100 to-red-100
        dark:from-pink-50 dark:via-purple-100 dark:to-blue-50
        px-4 py-20 text-center transition-colors duration-500"
      >
        <h1 className="text-6xl sm:text-7xl font-extrabold mb-6 transition-colors duration-300">
          <span className="text-[#791010] dark:text-pink-500">Boto</span>
          <span className="text-black dark:text-blue-800">Safe</span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mb-10 text-gray-700 dark:text-gray-800 transition-colors duration-300">
          Your all-in-one student voting platform—secure, smart, and
          stress-free.
        </p>

        {election ? (
          <div
            className="bg-gradient-to-r from-purple-200 to-blue-200
            dark:from-pink-100 dark:via-purple-200 dark:to-blue-100
            py-6 px-8 rounded-2xl shadow-xl mb-6
            transition-colors duration-500"
          >
            {phase === "before" && (
              <>
                <p className="text-sm text-gray-800 dark:text-gray-700 uppercase mb-2">
                  Voting has not started yet
                </p>
                <h2 className="text-2xl font-bold text-[#791010] dark:text-pink-500 mb-4">
                  Starts in: {formatTime(timeLeft)}
                </h2>
              </>
            )}

            {phase === "ongoing" && (
              <>
                <p className="text-sm text-gray-800 dark:text-gray-700 uppercase mb-2">
                  Time remaining before vote ends
                </p>
                <h2 className="text-2xl font-bold text-[#791010] dark:text-pink-500 mb-4">
                  {formatTime(timeLeft)}
                </h2>
                {hasVoted ? (
                  <button
                    disabled
                    className="bg-gray-400 dark:bg-gray-300 text-white px-6 py-2 rounded-full font-semibold cursor-not-allowed shadow-md transition"
                  >
                    ✅ You already voted
                  </button>
                ) : (
                  <Link href="/pages/vote">
                    <button className="bg-[#791010] dark:bg-pink-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-[#5a0c0c] dark:hover:bg-pink-600 shadow-lg transition duration-300">
                      🗳️ Cast Your Vote
                    </button>
                  </Link>
                )}
              </>
            )}

            {phase === "ended" && (
              <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-700">
                🛑 Voting has ended
              </h2>
            )}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-700">
            No active election found
          </p>
        )}
      </div>
    </MainLayout>
  );
};

export default Home;
