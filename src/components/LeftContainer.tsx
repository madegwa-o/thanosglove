'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';


type ModelStatus = "INITIALIZING" | "LOADING_WASM" | "LOADING_MODEL" | "READY" | "ERROR" | "CAMERA_ERROR";
type ApiStatus = "IDLE" | "SENDING" | "SUCCESS" | "API_OFFLINE";

interface Landmark {
  x: number;
  y: number;
  z?: number;
}

interface ApiResponse {
  alphabet?: string;
}

export default function LeftContainer() {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });

  const [modelConfidence, setModelConfidence] = useState<number>(0);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("INITIALIZING");
  const [detectedAlphabet, setDetectedAlphabet] = useState<string>("—");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("IDLE");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastApiCallRef = useRef<number>(0);

  // Update dimensions if window is resized
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        setModelStatus("LOADING_WASM");
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        setModelStatus("LOADING_MODEL");
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        setModelStatus("READY");
      } catch (err) {
        setModelStatus("ERROR");
        console.error("MediaPipe Init Error:", err);
      }
    };
    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 2. API Communication Logic
  const sendToPythonAPI = async (landmarks: Landmark[]) => {
    const now = Date.now();
    if (now - lastApiCallRef.current < 200) return;
    lastApiCallRef.current = now;

    try {
      setApiStatus("SENDING");
      const response = await fetch('https://brianmabunda00-alphabet-classifier.hf.space/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: landmarks })
      });

      const data: ApiResponse = await response.json();
      if (data.alphabet) {
        setDetectedAlphabet(data.alphabet);
        setApiStatus("SUCCESS");

        // DISPATCH CUSTOM EVENT FOR OTHER COMPONENTS TO CONSUME
        const event = new CustomEvent('signLanguageDetected', {
          detail: { alphabet: data.alphabet }
        });
        window.dispatchEvent(event);
      }
    } catch (err) {
      setApiStatus("API_OFFLINE");
    }
  };

  // 3. Detection and Drawing Loop
  const runDetection = useCallback(() => {
    if (
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        landmarkerRef.current &&
        canvasRef.current
    ) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const startTimeMs = performance.now();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          setModelConfidence(10);

          const landmarks = results.landmarks[0];
          sendToPythonAPI(landmarks);

          const connections: [number, number][] = [
            [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
            [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
            [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
          ];

          ctx.lineWidth = 3;
          ctx.strokeStyle = "#6366f1";
          ctx.fillStyle = "#ffffff";

          connections.forEach(([start, end]) => {
            const startPt = landmarks[start];
            const endPt = landmarks[end];
            ctx.beginPath();
            ctx.moveTo(startPt.x * canvas.width, startPt.y * canvas.height);
            ctx.lineTo(endPt.x * canvas.width, endPt.y * canvas.height);
            ctx.stroke();
          });

          landmarks.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        } else {
          setModelConfidence(0);
        }
      } catch (e) {
        console.error("Detection Error:", e);
      }
    }
    // eslint-disable-next-line react-hooks/immutability
    requestRef.current = requestAnimationFrame(runDetection);
  }, []);

  // 4. Setup Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            requestRef.current = requestAnimationFrame(runDetection);
          };
        }
      } catch (err) {
        setModelStatus("CAMERA_ERROR");
      }
    };
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [runDetection]);

  return (
      <div className="w-full flex flex-col mb-8">
        <section
            className="relative overflow-hidden rounded-3xl border-2 border-white/10 w-full"
            style={{
              minHeight: `${0.6 * dimensions.height}px`,
              maxHeight: `${0.6 * dimensions.height}px`,
              maxWidth: `${0.56 * dimensions.width}px`
            }}
        >
          <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover bg-black block"
          />
          <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none'
              }}
          />

          {/* API Detection HUD */}
          <div className="absolute bottom-5 right-5 bg-black/80 p-4 rounded-xl text-center min-w-[80px] border border-white/10 z-10">
            <div className="text-[10px] text-indigo-400 mb-1 tracking-widest">DETECTED</div>
            <div className="text-[32px] font-bold text-white">{detectedAlphabet}</div>
          </div>

          <div
              className="absolute top-5 left-5 bg-black/60 px-3 py-1.5 rounded-md text-[10px] tracking-wide z-10"
              style={{ color: modelStatus === "READY" ? "#22c55e" : "#f59e0b" }}
          >
            STATUS: {modelStatus} | API: {apiStatus}
          </div>
        </section>

        <span className="text-white mt-6 mb-2 text-sm">Model Confidence:</span>
        <div className="bg-white/10 h-2 rounded overflow-hidden">
          <div
              className="h-full bg-indigo-600 transition-all duration-100"
              style={{ width: `${modelConfidence}%` }}
          />
        </div>
        <h4 className="text-white mt-2 text-right text-sm">{modelConfidence}%</h4>
      </div>
  );
}