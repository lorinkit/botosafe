"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/partials/Header";
import Image from "next/image";

// --- Types ---
type Election = {
  id: number;
  title: string;
  status: string;
  start_time: string;
};
type Candidate = {
  id: number;
  user_id: number;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: Achievement[];
  photo_url: string;
  partylist: string;
  coc_file_url: string;
  status: string;
  fullname: string;
};
type Position = { id: number; name: string };

type Achievement = {
  title: string;
  type: string;
};

export default function CandidateFilingPage() {
  // --- state ---
  const [user, setUser] = useState<{ id: number; fullname: string } | null>(
    null
  );
  const [latestElection, setLatestElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);

  // form fields
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [partylist, setPartylist] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cocFile, setCocFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const [alreadyFiled, setAlreadyFiled] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );

  // --- focus trap for modal ---
  useEffect(() => {
    if (!isFilingModalOpen) return;
    const handleFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusableEls = modalRef.current.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >("button, [href], input, select, textarea");
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        (lastEl as HTMLElement).focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        (firstEl as HTMLElement).focus();
      }
    };
    document.addEventListener("keydown", handleFocus);
    return () => document.removeEventListener("keydown", handleFocus);
  }, [isFilingModalOpen]);

  // --- data fetching ---
  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetch("/api/elections")
      .then((res) => res.json())
      .then((data: Election[]) => {
        const ongoing = data.filter((e) => e.status !== "ended");
        if (ongoing.length > 0) {
          const latest = ongoing.reduce((prev, curr) =>
            new Date(prev.start_time) > new Date(curr.start_time) ? prev : curr
          );
          setLatestElection(latest);
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/positions")
      .then((res) => res.json())
      .then((data) => setPositions(data));
  }, []);

  useEffect(() => {
    if (!latestElection) return;
    fetch("/api/candidates")
      .then((res) => res.json())
      .then((data: Candidate[]) => {
        setCandidates(
          data.filter(
            (c) =>
              c.status === "approved" && c.election_id === latestElection.id
          )
        );

        if (user) {
          const filed = data.some(
            (c) => c.user_id === user.id && c.election_id === latestElection.id
          );
          setAlreadyFiled(filed);
        }
      });
  }, [latestElection, user]);

  // --- group candidates ---
  const candidatesByPosition = candidates.reduce(
    (acc: Record<string, Candidate[]>, candidate) => {
      if (!acc[candidate.position_name]) acc[candidate.position_name] = [];
      acc[candidate.position_name].push(candidate);
      return acc;
    },
    {}
  );

  const filteredCandidatesByPosition = Object.fromEntries(
    Object.entries(candidatesByPosition).map(([pos, cands]) => [
      pos,
      cands.filter(
        (c) =>
          c.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.election_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.position_name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    ])
  );

  // --- file candidacy ---
  const handleFile = async () => {
    if (
      !latestElection ||
      !selectedPositionId ||
      achievements.length === 0 ||
      !photoFile ||
      !cocFile ||
      !user
    ) {
      setFormError("All fields are required (including achievements & CoC)!");
      return;
    }

    setFormError("");
    setLoading(true);

    try {
      const photoForm = new FormData();
      photoForm.append("file", photoFile);
      const photoRes = await fetch("/api/upload", {
        method: "POST",
        body: photoForm,
      });
      if (!photoRes.ok) throw new Error("Photo upload failed");
      const photoData = await photoRes.json();

      const cocForm = new FormData();
      cocForm.append("file", cocFile);
      const cocRes = await fetch("/api/upload", {
        method: "POST",
        body: cocForm,
      });
      if (!cocRes.ok) throw new Error("CoC upload failed");
      const cocData = await cocRes.json();

      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          election_id: latestElection.id,
          position_id: selectedPositionId,
          achievements, // now an array of {title, type}
          photo_url: photoData.url,
          coc_file_url: cocData.url,
          partylist,
        }),
      });

      if (res.ok) {
        setIsFilingModalOpen(false);
        setSelectedPositionId("");
        setAchievements([]);
        setPartylist("");
        setPhotoFile(null);
        setPhotoUrl("");
        setCocFile(null);

        fetch("/api/candidates")
          .then((res) => res.json())
          .then((data: Candidate[]) => {
            setCandidates(
              data.filter(
                (c) =>
                  c.status === "approved" && c.election_id === latestElection.id
              )
            );

            if (user) {
              const filed = data.some(
                (c) =>
                  c.user_id === user.id && c.election_id === latestElection.id
              );
              setAlreadyFiled(filed);
            }
          });
      } else {
        setFormError("Failed to file candidacy.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("An unknown error occurred.");
      }
    }
  };

  // --- achievement handlers ---
  const addAchievement = () =>
    setAchievements([...achievements, { title: "", type: "" }]);

  const updateAchievement = (
    index: number,
    field: keyof Achievement,
    value: string
  ) => {
    const newAchievements = [...achievements];
    newAchievements[index][field] = value;
    setAchievements(newAchievements);
  };

  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  // --- UI ---
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100">
      {/* Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <Image
          src="/images/botosafe-logo.png"
          alt="Logo Watermark"
          width={600} // required
          height={600} // required
          className="w-full max-w-3xl opacity-5 object-contain"
        />
      </div>

      <Header />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Top */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {latestElection
                ? `Candidates — ${latestElection.title}`
                : "Candidates"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse candidates and file your candidacy for the current
              election.
            </p>
          </div>

          {latestElection && (
            <button
              onClick={() => setIsFilingModalOpen(true)}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow hover:shadow-lg transform hover:-translate-y-0.5 transition"
            >
              + File Candidacy
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
              />
            </svg>
            <input
              type="text"
              aria-label="Search candidates"
              placeholder="Search by name, election, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-300 text-sm"
            />
          </div>
        </div>

        {/* Candidate list */}
        {Object.entries(filteredCandidatesByPosition).map(([pos, cands]) => (
          <div key={pos} className="mb-10">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {pos.toUpperCase()}
            </h2>

            {cands.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cands.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transform hover:-translate-y-1 transition border cursor-pointer"
                    onClick={() => setSelectedCandidate(c)} // open modal
                  >
                    <div className="w-full h-48 relative">
                      <Image
                        src={c.photo_url || "/images/default-avatar.png"}
                        alt={c.fullname}
                        fill // lets it fill parent container
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute left-4 bottom-3 text-white">
                        <h3 className="text-lg font-bold drop-shadow">
                          {c.fullname}
                        </h3>
                        <p className="text-sm drop-shadow">{c.position_name}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No candidates found.</p>
            )}
          </div>
        ))}

        {/* Candidate Details Modal */}
        <AnimatePresence>
          {selectedCandidate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative"
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>

                {/* Header */}
                <div className="flex items-center gap-4">
                  <Image
                    src={
                      selectedCandidate.photo_url ||
                      "/images/default-avatar.png"
                    }
                    alt={selectedCandidate.fullname}
                    width={96}
                    height={96}
                    className="w-24 h-24 object-cover rounded-full border"
                  />

                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedCandidate.fullname}
                    </h2>
                    <p className="text-gray-600">
                      {selectedCandidate.position_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedCandidate.partylist || "Independent"}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Election:</span>{" "}
                    {selectedCandidate.election_title}
                  </p>

                  {selectedCandidate.achievements && (
                    <div>
                      <span className="font-medium">Achievements:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {selectedCandidate.achievements &&
                        selectedCandidate.achievements.length > 0 ? (
                          selectedCandidate.achievements.map(
                            (a: Achievement, idx: number) => (
                              <li key={idx}>
                                <strong>{a.type}:</strong> {a.title}
                              </li>
                            )
                          )
                        ) : (
                          <li>No achievements listed</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filing Modal */}
      <AnimatePresence>
        {isFilingModalOpen && latestElection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6"
            >
              <h2 className="text-lg font-bold mb-3 text-gray-900">
                File Candidacy — {latestElection.title}
              </h2>

              {alreadyFiled ? (
                <div className="p-4 text-center text-gray-700">
                  ✅ You have already filed your candidacy for this election.
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => setIsFilingModalOpen(false)}
                      className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="p-2 mb-3 bg-red-100 text-red-700 text-sm rounded">
                      {formError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <select
                      value={selectedPositionId}
                      onChange={(e) => setSelectedPositionId(e.target.value)}
                      aria-label="Select position"
                      className="w-full p-3 border rounded-lg text-sm"
                    >
                      <option value="">Select Position</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Enter Partylist"
                      aria-label="Enter partylist"
                      value={partylist}
                      onChange={(e) => setPartylist(e.target.value)}
                      className="w-full p-3 border rounded-lg text-sm"
                    />

                    {/* Achievements Section */}
                    <div>
                      <label className="text-sm font-medium mb-1 flex items-center gap-2">
                        Achievements
                        <button
                          type="button"
                          onClick={() => setShowHelpModal(true)}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                          title="Learn more about achievement types"
                        >
                          ?
                        </button>
                      </label>

                      {achievements.map((ach, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row gap-2 mb-2"
                        >
                          {/* Achievement Title with inline remove button */}
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder="Achievement Title"
                              value={ach.title}
                              onChange={(e) =>
                                updateAchievement(i, "title", e.target.value)
                              }
                              className="w-full p-2 border rounded-lg text-sm pr-8"
                              title="Enter the name of your achievement (e.g., Dean’s List, Class President)"
                            />
                            <button
                              type="button"
                              onClick={() => removeAchievement(i)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700"
                              title="Remove this achievement"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Achievement Type */}
                          <select
                            value={ach.type}
                            onChange={(e) =>
                              updateAchievement(i, "type", e.target.value)
                            }
                            className="w-full sm:w-60 p-2 border rounded-lg text-sm"
                            title="Select the category that best describes this achievement"
                          >
                            <option value="">Select Type</option>
                            <option value="Academic or Professional Awards">
                              Academic
                            </option>
                            <option value="Leadership Roles">
                              Leadership Roles
                            </option>
                            <option value="Organizational Involvement">
                              Organizational Involvement
                            </option>
                            <option value="Community Engagement">
                              Community Engagement
                            </option>
                            <option value="Special Skills or Recognitions">
                              Special Skills / Recognitions
                            </option>
                          </select>
                        </div>
                      ))}

                      {/* Add Achievement Button */}
                      <button
                        type="button"
                        onClick={addAchievement}
                        className="mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm"
                      >
                        + Add Achievement
                      </button>
                    </div>

                    {/* Photo */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Photo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPhotoUrl(URL.createObjectURL(file));
                            setPhotoFile(file);
                          }
                        }}
                        className="w-full p-2 border rounded-lg text-sm"
                      />
                      {photoUrl && (
                        <div className="mt-2 text-center">
                          <Image
                            src={photoUrl}
                            alt="Preview"
                            width={96} // ⬅️ required for next/image
                            height={96} // ⬅️ required
                            className="w-24 h-24 object-cover rounded-full mx-auto"
                          />
                        </div>
                      )}
                    </div>

                    {/* COC */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Certificate of Candidacy (CoC)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setCocFile(file);
                        }}
                        className="w-full p-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      onClick={() => setIsFilingModalOpen(false)}
                      className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFile}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        loading
                          ? "bg-indigo-700 text-white cursor-wait"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {loading ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>

            {/* Help Modal */}
            <AnimatePresence>
              {showHelpModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative"
                  >
                    <button
                      onClick={() => setShowHelpModal(false)}
                      className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                    <h3 className="text-lg font-semibold mb-4">
                      Achievement Types Guide
                    </h3>
                    <div className="space-y-3 text-sm text-gray-700 max-h-96 overflow-y-auto">
                      <div>
                        <strong>1. Academic or Professional Awards</strong>
                        <p>
                          Scholarships, Dean’s list, medals, certifications,
                          research recognition
                        </p>
                      </div>
                      <div>
                        <strong>2. Leadership Roles</strong>
                        <p>
                          Previous student government positions (e.g., Class
                          President, Vice President), Committee chair roles,
                          Project leader or organizer of events
                        </p>
                      </div>
                      <div>
                        <strong>3. Organizational Involvement</strong>
                        <p>
                          Membership or officer roles in clubs,
                          fraternities/sororities, or organizations, Active
                          participation in school organizations (e.g., Debate
                          Club, Sports Team Captain, Arts Guild)
                        </p>
                      </div>
                      <div>
                        <strong>4. Community Engagement</strong>
                        <p>
                          Volunteer work or outreach projects, Initiatives
                          organized or led that benefited the school/community
                        </p>
                      </div>
                      <div>
                        <strong>5. Special Skills or Recognitions</strong>
                        <p>
                          Certifications (first aid, IT, language proficiency),
                          Recognized speaker, debater, athlete, or artist
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
