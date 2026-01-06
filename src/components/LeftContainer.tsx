import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

export default function LeftContainer() {
  // State for dimensions to ensure they stay consistent on re-renders/refresh
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const [model_confidence, setModelConfidence] = useState(0);
  const [modelStatus, setModelStatus] = useState("INITIALIZING");
  const [detectedAlphabet, setDetectedAlphabet] = useState("—");
  const [apiStatus, setApiStatus] = useState("IDLE");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const requestRef = useRef(null);
  const lastApiCallRef = useRef(0);

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
  const sendToPythonAPI = async (landmarks) => {
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
      
      const data = await response.json();
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
      const startTimeMs = performance.now();
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          // Hardcoding confidence to 10 as per your snippet
          setModelConfidence(10);

          const landmarks = results.landmarks[0];
          sendToPythonAPI(landmarks);

          const connections = [
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
    requestRef.current = requestAnimationFrame(runDetection);
  }, []);

  // 4. Setup Camera
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
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
    <div className="LeftContainer" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <section className="viewport" style={{ 
        position: 'relative', 
        overflow: 'hidden', 
        borderRadius: '1.25rem',
        border: '2px solid rgba(255,255,255,0.1)', // Using explicit rgba for border since tailwind isn't active
        width: '100%',
        minHeight: `${0.6 * dimensions.height}px`,
        maxHeight: `${0.6 * dimensions.height}px`,
        maxWidth: `${0.56 * dimensions.width}px`
      }}>
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover", 
            backgroundColor: "#000", 
            display: 'block' 
          }} 
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
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(0,0,0,0.8)', padding: '15px', borderRadius: '12px', textAlign: 'center', minWidth: '80px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
          <div style={{ fontSize: '10px', color: '#818cf8', marginBottom: '5px', letterSpacing: '0.2em' }}>DETECTED</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>{detectedAlphabet}</div>
        </div>

        <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '10px', color: modelStatus === "READY" ? "#22c55e" : "#f59e0b", zIndex: 10, letterSpacing: '0.1em' }}>
          STATUS: {modelStatus} | API: {apiStatus}
        </div>
      </section>

      <span className='tech-label' style={{ justifySelf: "left", color: "white", marginTop: '1.5rem', display: 'block' }}>Model Confidence : </span>
      <div className="progress-track" style={{ background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
        <div className="progress-filler" style={{ width: `${model_confidence}%`, height: '100%', background: '#6366f1', transition: 'width 0.1s linear' }}></div>
      </div>
      <h4 style={{ justifySelf: "right", color: 'white', marginTop: '0.5rem' }}>{model_confidence} %</h4>
    </div>
  );
}