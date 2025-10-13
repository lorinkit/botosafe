"use client";

import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

interface FaceCanvasProps {
  onReady?: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => void;
  width?: number;
  height?: number;
}

/**
 * FaceCanvas renders both the video feed and an overlaid canvas for drawing landmarks.
 * The parent can access the canvas DOM via ref.
 */
const FaceCanvas = forwardRef<HTMLCanvasElement, FaceCanvasProps>(
  ({ onReady, width = 640, height = 480 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Expose the internal canvasRef to the parent
    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

    useEffect(() => {
      if (onReady && videoRef.current && canvasRef.current) {
        onReady(videoRef.current, canvasRef.current);
      }
    }, [onReady]);

    return (
      <div className="relative w-full max-w-[720px] mx-auto">
        {/* Hidden video for processing */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width={width}
          height={height}
          className="absolute top-0 left-0 w-full h-auto rounded-lg"
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute top-0 left-0 w-full h-auto rounded-lg pointer-events-none"
        />
      </div>
    );
  }
);

FaceCanvas.displayName = "FaceCanvas";
export default FaceCanvas;
