"use client";

import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { FaTrash, FaEdit } from "react-icons/fa";

type Election = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  filing_start_time: string | null;
  filing_end_time: string | null;
  status: string;
  created_at: string;
};

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [isElectionModalOpen, setIsElectionModalOpen] = useState(false);
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<Election | null>(null);

  // election fields
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [filingStartTime, setFilingStartTime] = useState("");
  const [filingEndTime, setFilingEndTime] = useState("");
  const [loading, setLoading] = useState(false);

  // position fields
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [positionName, setPositionName] = useState("");
  const [posLoading, setPosLoading] = useState(false);

  // Fetch elections
  const refreshElections = async () => {
    const res = await fetch("/api/elections");
    if (res.ok) {
      const data = await res.json();
      setElections(data);
    }
  };

  useEffect(() => {
    refreshElections();
    const interval = setInterval(refreshElections, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format for datetime-local input
  const formatForInput = (dateStr: string | null) =>
    dateStr ? format(parseISO(dateStr), "yyyy-MM-dd'T'HH:mm") : "";

  // Save election
  const handleSaveElection = async () => {
    setLoading(true);

    const payload = {
      title,
      start_time: startTime,
      end_time: endTime,
      filing_start_time: filingStartTime || null,
      filing_end_time: filingEndTime || null,
    };

    const res = await fetch(
      editingElection
        ? `/api/elections/${editingElection.id}`
        : "/api/elections",
      {
        method: editingElection ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      await refreshElections();
      closeElectionModal();
    }
    setLoading(false);
  };

  // Save position
  const handleSavePosition = async () => {
    if (!selectedElectionId || !positionName) return;
    setPosLoading(true);

    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        election_id: Number(selectedElectionId),
        name: positionName,
      }),
    });

    if (res.ok) {
      setSelectedElectionId("");
      setPositionName("");
      setIsPositionModalOpen(false);
    }

    setPosLoading(false);
  };

  // Delete election
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this election?")) return;
    const res = await fetch(`/api/elections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setElections(elections.filter((e) => e.id !== id));
    }
  };

  // Edit election
  const handleEdit = (election: Election) => {
    setEditingElection(election);
    setTitle(election.title);
    setStartTime(formatForInput(election.start_time));
    setEndTime(formatForInput(election.end_time));
    setFilingStartTime(formatForInput(election.filing_start_time));
    setFilingEndTime(formatForInput(election.filing_end_time));
    setIsElectionModalOpen(true);
  };

  const closeElectionModal = () => {
    setIsElectionModalOpen(false);
    setEditingElection(null);
    setTitle("");
    setStartTime("");
    setEndTime("");
    setFilingStartTime("");
    setFilingEndTime("");
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Elections</h1>
          <p className="text-sm text-gray-500">
            Manage election periods and candidate positions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPositionModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition"
          >
            + Create Position
          </button>
          <button
            onClick={() => setIsElectionModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition"
          >
            + Create Election
          </button>
        </div>
      </div>

      {/* Elections Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Filing Period</th>
              <th className="p-3">Election Period</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {elections.map((e, idx) => (
              <tr
                key={e.id}
                className={`border-t ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-gray-100`}
              >
                <td className="p-3 font-medium text-gray-900">{e.title}</td>
                <td className="p-3 text-gray-700">
                  {e.filing_start_time
                    ? `${format(
                        parseISO(e.filing_start_time),
                        "PPpp"
                      )} - ${format(parseISO(e.filing_end_time!), "PPpp")}`
                    : "N/A"}
                </td>
                <td className="p-3 text-gray-700">
                  {format(parseISO(e.start_time), "PPpp")} -{" "}
                  {format(parseISO(e.end_time), "PPpp")}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      e.status === "ongoing"
                        ? "bg-green-100 text-green-700"
                        : e.status === "upcoming"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="p-3 flex justify-center gap-3">
                  <button
                    onClick={() => handleEdit(e)}
                    className="text-blue-600 hover:text-blue-800 transition"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-red-600 hover:text-red-800 transition"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Election Modal */}
      {isElectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              {editingElection ? "Edit Election" : "Create Election"}
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <label className="block text-sm text-gray-600">
                Filing Start
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                  value={filingStartTime}
                  onChange={(e) => setFilingStartTime(e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-600">
                Filing End
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                  value={filingEndTime}
                  onChange={(e) => setFilingEndTime(e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-600">
                Election Start
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-600">
                Election End
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeElectionModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveElection}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Position Modal */}
      {isPositionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              Create Position
            </h2>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600">
                Election
                <select
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 mt-1"
                  value={selectedElectionId}
                  onChange={(e) => setSelectedElectionId(e.target.value)}
                >
                  <option value="">-- Select Election --</option>
                  {elections.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                placeholder="Position Name"
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                value={positionName}
                onChange={(e) => setPositionName(e.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsPositionModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePosition}
                disabled={posLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow"
              >
                {posLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
