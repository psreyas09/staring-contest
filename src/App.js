import React, { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
//import * as cam from '@mediapipe/camera_utils';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Click Start to begin the staring contest');
  const [blinkDetected, setBlinkDetected] = useState(false);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const [time, setTime] = useState(0);

  // Calculate Eye Aspect Ratio for blink detection
  const calculateEAR = (landmarks, eyeIndices) => {
    const dist = (i1, i2) => {
      const dx = landmarks[i1].x - landmarks[i2].x;
      const dy = landmarks[i1].y - landmarks[i2].y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Eye landmarks from MediaPipe face mesh
    const A = dist(eyeIndices[1], eyeIndices[5]);
    const B = dist(eyeIndices[2], eyeIndices[4]);
    const C = dist(eyeIndices[0], eyeIndices[3]);

    return (A + B) / (2.0 * C);
  };

  // Callback called on each FaceMesh result
  const onResults = (results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      drawResults(null);
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    const landmarks = results.multiFaceLandmarks[0];

    // Left and right eye landmark indices from MediaPipe
    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];

    const leftEAR = calculateEAR(landmarks, leftEyeIndices);
    const rightEAR = calculateEAR(landmarks, rightEyeIndices);
    const ear = (leftEAR + rightEAR) / 2;

    // Blink if EAR below this threshold
    const BLINK_THRESHOLD = 0.25;

    if (ear < BLINK_THRESHOLD) {
      if (!blinkDetected) {
        setBlinkDetected(true);
        setStatus('Blink detected! You lose!');
        stopTimer();
        stopCamera();
      }
    } else {
      if (blinkDetected) {
        // Reset blinkDetected to allow next game
        setBlinkDetected(false);
      }
    }
  };

  // Draw fallback frame if no face found
  const drawResults = (img) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (img) ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const startTimer = () => {
    setTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime((t) => t + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    // Stop webcam stream tracks
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  };

  // Start the game: setup camera, face mesh, timer
  const startGame = async () => {
    setStatus('Starting game... Keep your eyes open!');
    setBlinkDetected(false);
    setTime(0);

    stopCamera();
    stopTimer();

    faceMeshRef.current = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMeshRef.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMeshRef.current.onResults(onResults);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await faceMeshRef.current.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      cameraRef.current.start();

      startTimer();
    } catch (error) {
      setStatus('Error accessing webcam: ' + error.message);
    }
  };

  const restartGame = () => {
    stopCamera();
    stopTimer();
    setStatus('Click Start to begin the staring contest');
    setBlinkDetected(false);
    setTime(0);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopTimer();
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <h1>Staring Contest Game</h1>

      {/* Hidden video element for webcam */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        muted
        width="640"
        height="480"
      />

      {/* Canvas to display webcam & overlay */}
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ border: '1px solid black' }}
      />

      <div style={{ marginTop: '20px' }}>
        <button onClick={startGame} disabled={blinkDetected}>
          Start
        </button>
        <button onClick={restartGame} style={{ marginLeft: '10px' }}>
          Restart
        </button>
      </div>

      <h2>{status}</h2>
      <h3>Time: {time} seconds</h3>
    </div>
  );
}

export default App;
