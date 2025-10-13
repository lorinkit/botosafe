"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type * as FaceAPI from "@vladmandic/face-api";

type ProgressState = {
  blink: boolean;
  mouth: boolean;
  head: boolean;
};

type StepType = "blink" | "mouth" | "head" | "done";

// ---------------- SSR Polyfill ----------------
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

export default function FaceRegistrationPage() {
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
  const [registering, setRegistering] = useState(false);

  const EAR_THRESHOLD = 0.3;
  const MAR_THRESHOLD = 0.6;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@vladmandic/face-api").then((mod) => setFaceapi(mod));
  }, []);

  // Load models
  useEffect(() => {
    if (!faceapi) return;

    const loadModels = async () => {
      try {
        setStatus("⚙️ Initializing TensorFlow...");
        await tf.ready();
        await tf.setBackend("webgl").catch(async () => {
          await tf.setBackend("cpu");
        });

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

  // ✅ Memoized face registration (resolves ESLint warning)
  const registerFace = useCallback(
    async (video: HTMLVideoElement) => {
      if (!faceapi) return;
      setRegistering(true);
      setStatus("🧠 Capturing and saving your face...");

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setStatus("❌ No face detected. Retrying...");
          setRegistering(false);
          setStep("blink");
          return;
        }

        const embedding = Array.from(detection.descriptor);
        const userIdStr = localStorage.getItem("userId");
        if (!userIdStr) {
          setStatus("❌ Session expired. Please log in again.");
          setRegistering(false);
          return;
        }

        const res = await fetch("/api/register-face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: Number(userIdStr), embedding }),
        });

        if (res.ok) {
          setStatus("✅ Face registered successfully!");
          router.replace("/signin/face-scan");
        } else {
          const data: { message?: string } = await res.json();
          setStatus(
            `❌ Registration failed: ${data.message ?? "Unknown error"}`
          );
        }
      } catch (err) {
        console.error(err);
        setStatus("⚠️ Registration failed.");
      } finally {
        setRegistering(false);
      }
    },
    [faceapi, router]
  );

  // Camera + detection loop
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    let stream: MediaStream | null = null;
    let animationId = 0;

    const startCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            aspectRatio: 4 / 3,
          },
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
        if (!video || !faceapi) return;

        const detection =
          (await faceapi
            .detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
            )
            .withFaceLandmarks()) ?? null;

        if (detection) {
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
            }
          }

          if (step === "done" && !registering) {
            await registerFace(video);
          }
        }

        animationId = requestAnimationFrame(detectLoop);
      };

      detectLoop();
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animationId);
    };
  }, [modelsLoaded, faceapi, step, registering, registerFace]);

  if (!mounted) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-purple-100 to-red-100 px-4 py-12">
      <div className="w-full max-w-3xl bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-red-200 relative">
        <h1 className="text-2xl font-bold text-[#791010] text-center mb-4">
          Face Registration
        </h1>
        <p className="text-center text-gray-700 mb-4">
          Actions: Blink → Open Mouth → Turn Head
        </p>

        <div className="flex flex-col items-center w-full max-w-[640px] aspect-video mx-auto relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="rounded-lg shadow w-full h-full object-contain bg-black"
          />
          {registering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg backdrop-blur-sm">
              <div className="w-16 h-16 border-4 border-t-red-600 border-gray-300 rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-start mt-4 ml-4 text-sm">
          <div className="bg-white/90 rounded-lg shadow p-3 border border-gray-300">
            <p className={progress.blink ? "text-green-600" : "text-gray-600"}>
              {progress.blink ? "✅ Blink" : "⬜ Blink"}
            </p>
            <p className={progress.mouth ? "text-green-600" : "text-gray-600"}>
              {progress.mouth ? "✅ Open Mouth" : "⬜ Open Mouth"}
            </p>
            <p className={progress.head ? "text-green-600" : "text-gray-600"}>
              {progress.head ? "✅ Turn Head" : "⬜ Turn Head"}
            </p>
          </div>

          <p className="mt-4 text-center w-full font-semibold text-gray-700">
            {step === "blink" && "👁 Blink now..."}
            {step === "mouth" && "👄 Open your mouth..."}
            {step === "head" && "🌀 Turn your head left or right..."}
            {step === "done" && "✅ Liveness check passed!"}
          </p>
        </div>

        <p className="text-center mt-4 text-gray-600">{status}</p>
      </div>
    </main>
  );
}
