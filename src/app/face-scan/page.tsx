"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type * as FaceAPI from "@vladmandic/face-api";

type ProgressState = { blink: boolean; mouth: boolean; head: boolean };
type StepType = "blink" | "mouth" | "head" | "done";
type VotePayload = { userId: number; votes: Record<string, number> };
type Candidate = { id: number; fullname: string; position_name: string };

// ✅ SSR Polyfill for TextEncoder/TextDecoder
if (typeof window === "undefined") {
  import("util").then((util) => {
    if (!("TextEncoder" in globalThis)) {
      (
        globalThis as unknown as { TextEncoder: typeof util.TextEncoder }
      ).TextEncoder = util.TextEncoder;
    }
    if (!("TextDecoder" in globalThis)) {
      (
        globalThis as unknown as { TextDecoder: typeof util.TextDecoder }
      ).TextDecoder = util.TextDecoder;
    }
  });
}

export default function FaceScanVotePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [faceapi, setFaceapi] = useState<typeof FaceAPI | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [step, setStep] = useState<StepType>("blink");
  const [progress, setProgress] = useState<ProgressState>({
    blink: false,
    mouth: false,
    head: false,
  });
  const [verifying, setVerifying] = useState(false);
  const [livenessDone, setLivenessDone] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [votedCandidates, setVotedCandidates] = useState<Candidate[]>([]);

  const EAR_THRESHOLD = 0.3;
  const MAR_THRESHOLD = 0.6;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@vladmandic/face-api").then((mod) => setFaceapi(mod));
  }, []);

  // --- EAR & MAR calculations ---
  const eyeAspectRatio = (eye: FaceAPI.Point[]): number => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2 * h);
  };

  const mouthAspectRatio = (mouth: FaceAPI.Point[]): number => {
    const v = Math.hypot(mouth[13].x - mouth[19].x, mouth[13].y - mouth[19].y);
    const h = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);
    return v / h;
  };

  // --- Verify & Submit Vote ---
  const verifyAndSubmitVote = useCallback(
    async (video: HTMLVideoElement): Promise<void> => {
      if (!faceapi) return;
      setVerifying(true);
      setStatus("🧠 Verifying your face before voting...");

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      );

      try {
        await Promise.race([
          (async () => {
            const detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!detection) throw new Error("no_face");

            const embedding = Array.from(detection.descriptor);
            const userIdStr = localStorage.getItem("userId");
            if (!userIdStr) throw new Error("session_expired");

            const res = await fetch("/api/verify-face", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: Number(userIdStr), embedding }),
            });

            const data: { match?: boolean; message?: string } =
              await res.json();
            if (!res.ok || !data.match)
              throw new Error(data.message ?? "mismatch");

            const pendingVote = localStorage.getItem("pendingVote");
            if (!pendingVote) throw new Error("no_vote");
            const payload = JSON.parse(pendingVote) as VotePayload;
            const electionId = Number(localStorage.getItem("electionId"));

            const tokenRes = await fetch("/api/generate-vote-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: payload.userId, electionId }),
            });

            const { voteToken } = await tokenRes.json();
            if (!voteToken) throw new Error("token_failed");

            const voteRes = await fetch("/api/vote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ votes: payload.votes, voteToken }),
            });

            if (!voteRes.ok) throw new Error("vote_failed");

            // 🧾 Display receipt
            const candidateData: Candidate[] = JSON.parse(
              localStorage.getItem("candidateList") ?? "[]"
            );
            const votedList = candidateData.filter((c) =>
              Object.values(payload.votes).includes(c.id)
            );
            setVotedCandidates(votedList);
            setShowReceipt(true);

            localStorage.removeItem("pendingVote");
            stopCamera();
            setStatus("✅ Vote successfully submitted!");
          })(),
          timeout,
        ]);
      } catch (err) {
        console.error("Verification Error:", err);
        stopCamera();
        setStatus("⚠️ Verification failed. Try again.");
        setTimeout(() => resetCheck(), 2000);
      } finally {
        setVerifying(false);
      }
    },
    [faceapi]
  );

  // --- Stop camera ---
  const stopCamera = (): void => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  };

  // --- Reset check ---
  const resetCheck = (): void => {
    stopCamera();
    setLivenessDone(false);
    setStep("blink");
    setProgress({ blink: false, mouth: false, head: false });
  };

  // --- Load Models ---
  useEffect(() => {
    if (!faceapi) return;
    const loadModels = async (): Promise<void> => {
      try {
        setStatus("⚙️ Initializing TensorFlow...");
        await tf.ready();
        try {
          await tf.setBackend("webgl");
        } catch {
          await tf.setBackend("cpu");
        }

        setStatus("📦 Loading face-api models...");
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setModelsLoaded(true);
        setStatus("✅ Models loaded. Starting camera...");
      } catch (err) {
        console.error(err);
        setStatus("❌ Model loading failed");
      }
    };
    loadModels();
  }, [faceapi]);

  // --- Camera & Detection ---
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    let stream: MediaStream | null = null;
    let animationId = 0;
    let detectionRunning = true;

    const startCamera = async (): Promise<void> => {
      const video = videoRef.current;
      if (!video) return;

      try {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();
        setStatus("📸 Camera ready...");
      } catch (err) {
        console.error(err);
        setStatus("❌ Camera access failed");
        return;
      }

      const detectLoop = async (): Promise<void> => {
        if (!detectionRunning || !video || !faceapi) return;

        try {
          const detection = await faceapi
            .detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
            )
            .withFaceLandmarks();

          if (detection && !livenessDone) {
            const landmarks = detection.landmarks;
            const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
            const rightEAR = eyeAspectRatio(landmarks.getRightEye());
            const ear = (leftEAR + rightEAR) / 2;
            const mar = mouthAspectRatio(landmarks.getMouth());

            if (step === "blink" && ear < EAR_THRESHOLD) {
              setProgress((p) => ({ ...p, blink: true }));
              setStep("mouth");
              setStatus("👄 Open your mouth");
            }

            if (step === "mouth" && mar > MAR_THRESHOLD) {
              setProgress((p) => ({ ...p, mouth: true }));
              setStep("head");
              setStatus("🌀 Turn your head left or right");
            }

            if (step === "head") {
              const noseX = landmarks.getNose()[3].x;
              const leftX = landmarks.positions[0].x;
              const rightX = landmarks.positions[16].x;
              const ratio = (noseX - leftX) / (rightX - leftX);

              if (ratio < 0.35 || ratio > 0.65) {
                setProgress((p) => ({ ...p, head: true }));
                setStep("done");
                setStatus("✅ Liveness check passed!");
                setLivenessDone(true);
                detectionRunning = false;
                cancelAnimationFrame(animationId);
                await verifyAndSubmitVote(video);
                return;
              }
            }
          }
        } catch (error) {
          console.error("Detection error:", error);
        }

        animationId = requestAnimationFrame(detectLoop);
      };

      detectLoop();
    };

    startCamera();

    return () => {
      detectionRunning = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animationId);
    };
  }, [modelsLoaded, faceapi, livenessDone, step, verifyAndSubmitVote]);

  if (!mounted)
    return React.createElement("main", { className: "min-h-screen bg-white" });

  // --- UI ---
  return React.createElement(
    "main",
    {
      className:
        "min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-purple-100 to-red-100 px-4 py-12",
    },
    React.createElement(
      "div",
      {
        className:
          "w-full max-w-3xl bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-red-200 relative",
      },
      React.createElement(
        "h1",
        { className: "text-2xl font-bold text-[#791010] text-center mb-4" },
        "Face Verification for Voting"
      ),
      React.createElement(
        "p",
        { className: "text-center text-gray-700 mb-4" },
        "Actions: Blink → Open Mouth → Turn Head"
      ),
      React.createElement(
        "div",
        {
          className:
            "flex flex-col items-center w-full max-w-[480px] aspect-square mx-auto relative",
        },
        React.createElement("video", {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted: true,
          className: "rounded-lg shadow w-full h-full object-contain bg-black",
        }),
        verifying
          ? React.createElement(
              "div",
              {
                className:
                  "absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg backdrop-blur-sm",
              },
              React.createElement("div", {
                className:
                  "w-16 h-16 border-4 border-t-red-600 border-gray-300 rounded-full animate-spin",
              })
            )
          : null
      ),
      React.createElement(
        "div",
        { className: "flex flex-col items-start mt-4 ml-4 text-sm" },
        React.createElement(
          "div",
          {
            className:
              "bg-white/90 rounded-lg shadow p-3 border border-gray-300",
          },
          React.createElement(
            "p",
            { className: progress.blink ? "text-green-600" : "text-gray-600" },
            progress.blink ? "✅ Blink" : "⬜ Blink"
          ),
          React.createElement(
            "p",
            { className: progress.mouth ? "text-green-600" : "text-gray-600" },
            progress.mouth ? "✅ Open Mouth" : "⬜ Open Mouth"
          ),
          React.createElement(
            "p",
            { className: progress.head ? "text-green-600" : "text-gray-600" },
            progress.head ? "✅ Turn Head" : "⬜ Turn Head"
          )
        ),
        React.createElement(
          "p",
          { className: "mt-4 text-center w-full font-semibold text-gray-700" },
          step === "blink"
            ? "👁 Blink now..."
            : step === "mouth"
            ? "👄 Open your mouth..."
            : step === "head"
            ? "🌀 Turn your head left or right..."
            : step === "done"
            ? "✅ Liveness check passed!"
            : ""
        )
      ),
      React.createElement(
        "p",
        { className: "text-center mt-4 text-gray-600" },
        status
      ),
      showReceipt
        ? React.createElement(
            "div",
            {
              className:
                "fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50",
            },
            React.createElement(
              "div",
              {
                className:
                  "bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 overflow-y-auto max-h-[80vh] border-t-4 border-red-600",
              },
              React.createElement(
                "h2",
                {
                  className:
                    "text-xl font-bold text-[#791010] mb-3 text-center",
                },
                "🧾 Voting Receipt"
              ),
              React.createElement(
                "p",
                { className: "text-gray-700 mb-3 text-center" },
                "Here are the candidates you voted for:"
              ),
              React.createElement(
                "ul",
                { className: "divide-y divide-gray-200 mb-4" },
                votedCandidates.map((c) =>
                  React.createElement(
                    "li",
                    { key: c.id, className: "py-2 text-gray-800 text-center" },
                    `${c.position_name}: `,
                    React.createElement(
                      "span",
                      { className: "font-semibold text-[#791010]" },
                      c.fullname
                    )
                  )
                )
              ),
              React.createElement(
                "button",
                {
                  className:
                    "w-full bg-gradient-to-r from-[#791010] to-[#d84141] text-white py-2 rounded-xl font-semibold hover:opacity-90 transition",
                  onClick: () => router.replace("/pages/dashboard"),
                },
                "Go to Dashboard"
              )
            )
          )
        : null
    )
  );
}
