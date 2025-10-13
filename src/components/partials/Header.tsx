"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { HiMenu, HiX } from "react-icons/hi";
import { FaUserCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";

type User = {
  fullname: string;
  hasVoted?: boolean; // 👈 add this field from your backend
};

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const toggleMenu = () => setMenuOpen(!menuOpen);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  // 👇 Vote click handler
  const handleVoteClick = () => {
    if (!user) {
      alert("⚠️ You are not logged in. Redirecting to Sign In...");
      router.push("/signin/login");
    } else if (user.hasVoted) {
      alert("✅ You have already voted. Redirecting to Dashboard...");
      router.push("/pages/dashboard");
    } else {
      router.push("/pages/vote");
    }
  };

  return (
    <header className="bg-white shadow-md px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/images/botosafe-logo.png"
            alt="BotoSafe Logo"
            width={40}
            height={40}
          />
          <span className="font-bold text-xl text-[#791010]">BotoSafe</span>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden text-[#791010] text-2xl focus:outline-none"
          onClick={toggleMenu}
        >
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-6 text-sm font-semibold uppercase text-[#791010]">
          <Link href="/" className="hover:text-[#5a0c0c]">
            Home
          </Link>
          <Link href="/pages/candidates" className="hover:text-[#5a0c0c]">
            Candidates
          </Link>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleVoteClick(); // reuse your function
              toggleMenu();
            }}
            className="hover:text-[#5a0c0c] uppercase"
          >
            VOTE
          </Link>
          <Link href="/pages/dashboard" className="hover:text-[#5a0c0c]">
            Dashboard
          </Link>

          {user ? (
            <Link
              href="/pages/profile"
              className="hover:text-[#5a0c0c] flex items-center gap-2"
            >
              <FaUserCircle className="text-2xl" />
              <span>{user.fullname}</span>
            </Link>
          ) : (
            <Link href="/signin/login" className="hover:text-[#5a0c0c]">
              Sign In
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <nav className="mt-4 flex flex-col gap-3 text-sm font-semibold uppercase text-[#791010] md:hidden">
          <Link href="/" className="hover:text-[#5a0c0c]" onClick={toggleMenu}>
            Home
          </Link>
          <Link
            href="/pages/candidates"
            className="hover:text-[#5a0c0c]"
            onClick={toggleMenu}
          >
            Candidates
          </Link>
          {/* Vote Link with Handler */}
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleVoteClick(); // reuse your function
              toggleMenu();
            }}
            className="hover:text-[#5a0c0c] uppercase"
          >
            VOTE
          </Link>
          <Link
            href="/pages/dashboard"
            className="hover:text-[#5a0c0c]"
            onClick={toggleMenu}
          >
            Dashboard
          </Link>

          {user ? (
            <Link
              href="/pages/profile"
              className="hover:text-[#5a0c0c] flex items-center gap-2"
              onClick={toggleMenu}
            >
              <FaUserCircle className="text-xl" />
              <span>{user.fullname}</span>
            </Link>
          ) : (
            <Link
              href="/signin/login"
              className="hover:text-[#5a0c0c]"
              onClick={toggleMenu}
            >
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;
