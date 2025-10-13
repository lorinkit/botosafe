"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otpDigits, setOtpDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [statusMessage, setStatusMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const inputRefs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    const storedEmail = localStorage.getItem("email") || "";
    const storedUserId = localStorage.getItem("userId") || "";
    setEmail(storedEmail);
    setUserId(storedUserId);

    // Auto-focus first OTP input on load
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 0);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSendOtp = async () => {
    if (sending) return; // 🔒 prevent duplicate requests

    if (!userId || !email) {
      setStatusMessage("Missing user information.");
      return;
    }

    setSending(true);
    setStatusMessage("");

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.message || "Failed to send OTP.");
      } else {
        setStatusMessage("OTP sent to your email.");
        setTimeLeft(5 * 60);
      }
    } catch {
      setStatusMessage("An error occurred while sending OTP.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setStatusMessage("");
    const otp = otpDigits.join("");

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.message || "Invalid OTP.");
      } else {
        // Save token
        localStorage.setItem("token", data.token);

        // ✅ Save complete user info
        localStorage.setItem("user", JSON.stringify(data.user));

        // ✅ Decide where to redirect
        if (data.user.hasFace) {
          router.push("/signin/face-scan");
        } else {
          router.push("/signin/face-register");
        }
      }
    } catch {
      setStatusMessage("An error occurred while verifying.");
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!email) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100">
      <Header />
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="w-full max-w-md bg-white/80 p-6 rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold text-[#791010] mb-2">VERIFY</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enter OTP verification code that was sent to your email
          </p>

          <div className="flex justify-center gap-2 mb-4">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                ref={(el) => {
                  inputRefs.current[idx] = el!;
                }}
                className="w-12 h-12 border rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            ))}
          </div>

          <div className="flex justify-between items-center mb-4">
            {timeLeft > 0 && (
              <span className="text-sm text-gray-500">
                {formatTime(timeLeft)}
              </span>
            )}
            <button
              type="button" // 🛑 prevent form auto-submit
              onClick={handleSendOtp}
              disabled={sending}
              className="text-sm text-purple-700 underline disabled:opacity-50"
            >
              {timeLeft > 0 ? "Resend OTP" : "Send OTP"}
            </button>
          </div>

          {statusMessage && (
            <p className="text-center text-red-600 mb-4">{statusMessage}</p>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full bg-[#791010] text-white py-2 rounded-lg hover:bg-red-800 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Confirm"}
          </button>
        </div>
      </div>
    </main>
  );
}
