"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import Image from "next/image";

type Candidate = {
  id: number;
  fullname: string;
  description: string;
  photo_url: string;
  election_id: number;
  position_id: number;
  position_name: string;
};

type GroupedCandidates = Record<string, Candidate[]>;

const VotePage: React.FC = () => {
  const [groupedCandidates, setGroupedCandidates] = useState<GroupedCandidates>(
    {}
  );
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [checkingVote, setCheckingVote] = useState(true);
  const [electionId, setElectionId] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  // 🟣 Fetch latest election
  useEffect(() => {
    const fetchElection = async (): Promise<void> => {
      try {
        const res = await fetch("/api/elections/latest");
        if (!res.ok) throw new Error("Failed to fetch election");
        const election = await res.json();
        setElectionId(election.id);
        localStorage.setItem("electionId", election.id.toString());
      } catch (error) {
        console.error("Error fetching latest election:", error);
        alert("❌ Failed to fetch latest election.");
        router.replace("/");
      }
    };
    fetchElection();
  }, [router]);

  // 🟡 Check election & user voting status
  useEffect(() => {
    if (!electionId) return;

    const checkStatus = async (): Promise<void> => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) {
          alert("⚠️ You are not logged in. Redirecting to Sign In...");
          router.replace("/signin/login");
          return;
        }

        const electionRes = await fetch(`/api/elections/${electionId}`);
        if (!electionRes.ok) {
          alert("❌ Failed to fetch election details.");
          router.replace("/");
          return;
        }

        const election = await electionRes.json();
        const now = new Date();
        const start = new Date(election.start_time);
        const end = new Date(election.end_time);

        if (now < start) {
          alert(
            "🕒 The election has not yet begun. Redirecting to homepage..."
          );
          router.replace("/");
          return;
        }
        if (now > end) {
          alert("✅ The election has ended. Redirecting to homepage...");
          router.replace("/");
          return;
        }

        const voteRes = await fetch(
          `/api/has-voted?userId=${userId}&electionId=${electionId}`
        );
        if (voteRes.ok) {
          const data = await voteRes.json();
          if (data.hasVoted) {
            alert("✅ You have already voted. Redirecting to Dashboard...");
            router.replace("/pages/dashboard");
            return;
          }
        }
      } catch (error) {
        console.error("Error checking status:", error);
      } finally {
        setCheckingVote(false);
      }
    };

    checkStatus();
  }, [electionId, router]);

  // 🔵 Fetch approved candidates
  useEffect(() => {
    if (!electionId) return;

    const fetchCandidates = async (): Promise<void> => {
      try {
        const res = await fetch("/api/candidates/approved");
        if (!res.ok) throw new Error("Failed to fetch candidates");
        const result = await res.json();
        const candidates: Candidate[] = result.candidates || [];
        const latest = candidates.filter((c) => c.election_id === electionId);

        const grouped: GroupedCandidates = {};
        latest.forEach((candidate) => {
          const key = `${candidate.position_id}:${candidate.position_name}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(candidate);
        });

        setGroupedCandidates(grouped);
      } catch (error) {
        console.error("Error fetching candidates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [electionId]);

  // 🟢 Scroll animation
  useEffect(() => {
    const handleScroll = (): void => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 🟠 Select candidate
  const handleSelect = (positionKey: string, candidateId: number): void => {
    setSelectedVotes((prev) => ({ ...prev, [positionKey]: candidateId }));
  };

  // 🟣 Open confirmation modal
  const handleOpenModal = (): void => {
    if (Object.keys(selectedVotes).length === 0) {
      alert("⚠️ Please select at least one candidate.");
      return;
    }
    setShowModal(true);
  };

  // 🔒 Confirm vote and save to localStorage
  const handleConfirmVote = (): void => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("⚠️ You must be logged in to vote.");
      router.push("/signin/login");
      return;
    }

    const votesForApi: Record<number, number> = {};
    for (const key in selectedVotes) {
      const [positionId] = key.split(":");
      votesForApi[parseInt(positionId)] = selectedVotes[key];
    }

    const payload = { userId, votes: votesForApi };
    localStorage.setItem("pendingVote", JSON.stringify(payload));
    router.push("/face-scan");
  };

  if (checkingVote)
    return React.createElement(
      "p",
      { className: "text-center mt-8" },
      "Checking election status..."
    );
  if (loading)
    return React.createElement(
      "p",
      { className: "text-center mt-8" },
      "Loading candidates..."
    );

  // 🧭 Main UI using React.createElement (no JSX)
  return React.createElement(
    "main",
    {
      className:
        "relative min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 overflow-x-hidden",
    },
    // Watermark
    React.createElement(
      "div",
      {
        className:
          "absolute inset-0 flex items-center justify-center pointer-events-none z-0",
        style: { transform: `translateY(${scrollY * 0.2}px)` },
      },
      React.createElement(Image, {
        src: "/images/botosafe-logo.png",
        alt: "Logo Watermark",
        fill: true,
        className: "object-contain opacity-5",
        priority: true,
      })
    ),

    React.createElement(Header),

    React.createElement(
      "div",
      { className: "relative z-10 max-w-4xl mx-auto p-4" },
      React.createElement(
        "h1",
        { className: "text-2xl font-bold text-center mb-6" },
        "Cast Your Vote"
      ),

      // Candidates Section
      ...Object.keys(groupedCandidates).map((key) => {
        const parts = key.split(":");
        const positionName = parts[1] ?? "Unknown";
        return React.createElement(
          "div",
          { key, className: "mb-6" },
          React.createElement(
            "h2",
            { className: "text-xl font-semibold mb-3" },
            positionName
          ),
          React.createElement(
            "div",
            { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            ...groupedCandidates[key].map((candidate) =>
              React.createElement(
                "div",
                {
                  key: candidate.id,
                  className: `p-4 border rounded-xl cursor-pointer transition-transform transform hover:scale-105 ${
                    selectedVotes[key] === candidate.id
                      ? "bg-blue-100 border-blue-500"
                      : "hover:bg-gray-100"
                  }`,
                  onClick: () => handleSelect(key, candidate.id),
                },
                React.createElement(Image, {
                  src: candidate.photo_url,
                  alt: candidate.fullname,
                  width: 96,
                  height: 96,
                  className: "object-cover rounded-full mx-auto mb-3",
                }),
                React.createElement(
                  "h3",
                  { className: "text-center font-bold" },
                  candidate.fullname
                ),
                React.createElement(
                  "p",
                  { className: "text-center text-sm text-gray-600" },
                  candidate.description
                )
              )
            )
          )
        );
      }),

      // Submit Button
      React.createElement(
        "button",
        {
          onClick: handleOpenModal,
          className:
            "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl mt-6 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg",
        },
        "Submit Vote"
      ),

      // Confirmation Modal
      showModal
        ? React.createElement(
            "div",
            {
              className: "fixed inset-0 z-50 flex items-center justify-center",
            },
            React.createElement("div", {
              className: "absolute inset-0 bg-black/50 backdrop-blur-sm",
            }),
            React.createElement(
              "div",
              {
                className:
                  "relative bg-white rounded-2xl shadow-2xl w-11/12 md:w-2/3 max-h-[80vh] p-6 overflow-y-auto z-10",
              },
              React.createElement(
                "h2",
                {
                  className:
                    "text-2xl font-bold mb-4 text-center text-gray-800",
                },
                "Confirm Your Vote"
              ),
              React.createElement(
                "div",
                { className: "space-y-4" },
                ...Object.entries(selectedVotes).map(([key, candidateId]) => {
                  const parts = key.split(":");
                  const positionName = parts[1] ?? "Unknown";
                  const candidate = groupedCandidates[key].find(
                    (c) => c.id === candidateId
                  );
                  if (!candidate) return null;
                  return React.createElement(
                    "div",
                    {
                      key: candidate.id,
                      className:
                        "flex items-center gap-4 border rounded-lg p-3 shadow-sm hover:shadow-md transition",
                    },
                    React.createElement(Image, {
                      src: candidate.photo_url,
                      alt: candidate.fullname,
                      width: 56,
                      height: 56,
                      className: "rounded-full object-cover",
                    }),
                    React.createElement(
                      "div",
                      null,
                      React.createElement(
                        "p",
                        { className: "font-semibold text-gray-800" },
                        candidate.fullname
                      ),
                      React.createElement(
                        "p",
                        { className: "text-sm text-gray-500" },
                        positionName
                      )
                    )
                  );
                })
              ),
              React.createElement(
                "div",
                { className: "flex justify-end gap-4 mt-6" },
                React.createElement(
                  "button",
                  {
                    onClick: () => setShowModal(false),
                    className:
                      "px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 transition",
                  },
                  "Cancel"
                ),
                React.createElement(
                  "button",
                  {
                    onClick: handleConfirmVote,
                    className:
                      "px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all",
                  },
                  "Confirm Vote"
                )
              )
            )
          )
        : null
    )
  );
};

export default VotePage;
