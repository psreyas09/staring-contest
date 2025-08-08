import React, { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

// Camera class loaded globally via CDN in public/index.html:
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  const [status, setStatus] = useState('Click Start to begin the staring contest');
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [time, setTime] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [videoVisible, setVideoVisible] = useState(false);

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  const calculateEAR = (landmarks, eyeIndices) => {
    const dist = (i1, i2) => {
      const dx = landmarks[i1].x - landmarks[i2].x;
      const dy = landmarks[i1].y - landmarks[i2].y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const A = dist(eyeIndices[1], eyeIndices[5]);
    const B = dist(eyeIndices[2], eyeIndices[4]);
    const C = dist(eyeIndices[0], eyeIndices[3]);

    return (A + B) / (2.0 * C);
  };

  // MediaPipe FaceMesh results callback
  const onResults = (results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      drawResults(null);
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    const landmarks = results.multiFaceLandmarks[0];

    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];

    const leftEAR = calculateEAR(landmarks, leftEyeIndices);
    const rightEAR = calculateEAR(landmarks, rightEyeIndices);
    const ear = (leftEAR + rightEAR) / 2;

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
        setBlinkDetected(false);
      }
    }
  };

  // Draw fallback if no face detected
  const drawResults = (img) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (img) ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // Game timer
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

  // Start webcam video stream immediately and show video
  const startWebcamStream = async () => {
    try {
      if (!videoRef.current.srcObject) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
      }
      setVideoVisible(true);
    } catch (error) {
      setStatus('Error accessing webcam: ' + error.message);
    }
  };

  // Start MediaPipe Camera processing after countdown
  const startMediaPipeCamera = () => {
    try {
      if (cameraRef.current) {
        cameraRef.current.start();
        return;
      }

      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => await faceMeshRef.current.send({ image: videoRef.current }),
        width: 640,
        height: 480,
      });
      cameraRef.current.start();
    } catch (error) {
      setStatus('Error starting MediaPipe Camera: ' + error.message);
    }
  };

  // Stop camera and video streams
  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoVisible(false);
  };

  // Initialize FaceMesh once on mount
  useEffect(() => {
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

    return () => {
      stopTimer();
      stopCamera();
      faceMeshRef.current?.close();
      faceMeshRef.current = null;
    };
  }, []);

  // Countdown timer before game starts, starts MediaPipe after countdown
  const startCountdown = () => {
    setCountdown(3);

    let counter = 3;
    const interval = setInterval(() => {
      counter -= 1;
      setCountdown(counter);

      if (counter === 0) {
        clearInterval(interval);
        setCountdown(0);
        setStatus('Starting game... Keep your eyes open!');
        startMediaPipeCamera();
        startTimer();
      }
    }, 1000);
  };

  // Start game handler - start webcam then countdown
  const startGame = async () => {
    setBlinkDetected(false);
    setTime(0);
    setStatus('Getting webcam ready...');
    await startWebcamStream();
    startCountdown();
  };

  // Restart game handler
  const restartGame = () => {
    stopTimer();
    stopCamera();
    setStatus('Click Start to begin the staring contest');
    setBlinkDetected(false);
    setTime(0);
    setCountdown(0);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '20px', position: 'relative', width: 640, marginLeft: 'auto', marginRight: 'auto' }}>
      <h1>Staring Contest Game</h1>

      <div style={{ position: 'relative', width: 640, height: 480 }}>
        {/* Video element hidden but active as source */}
        <video
          ref={videoRef}
          style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 480, opacity: videoVisible ? 1 : 0 }}
          playsInline
          muted
          width="640"
          height="480"
          autoPlay
        />

        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          style={{
            border: '1px solid black',
            position: 'absolute',
            top: 0,
            left: 0,
            width: 640,
            height: 480,
          }}
        />

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '96px',
              fontWeight: 'bold',
              color: 'red',
              pointerEvents: 'none',
              userSelect: 'none',
              textShadow: '2px 2px 4px black',
            }}
          >
            {countdown}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={startGame} disabled={blinkDetected || countdown > 0}>
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
