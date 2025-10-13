// app/admin/layout.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiX, FiHome, FiUsers } from "react-icons/fi";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-white shadow-lg transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className={`font-bold text-lg ${!sidebarOpen && "hidden"}`}>
            Admin
          </h1>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        <nav className="p-4 space-y-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center space-x-2 hover:text-blue-600"
          >
            <FiHome /> {sidebarOpen && <span>Dashboard</span>}
          </Link>
          <Link
            href="/admin/voters"
            className="flex items-center space-x-2 hover:text-blue-600"
          >
            <FiUsers /> {sidebarOpen && <span>Users</span>}
          </Link>
          <Link
            href="/admin/elections"
            className="flex items-center space-x-2 hover:text-blue-600"
          >
            <FiUsers /> {sidebarOpen && <span>Elections</span>}
          </Link>
          <Link
            href="/admin/candidates"
            className="flex items-center space-x-2 hover:text-blue-600"
          >
            <FiUsers /> {sidebarOpen && <span>Candidates</span>}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
