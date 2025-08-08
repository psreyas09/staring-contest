import React, { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

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
      if (blinkDetected) setBlinkDetected(false);
    }
  };

  const drawResults = (img) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (img) ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const startTimer = () => {
    setTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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

  const stopCamera = () => {
    if (cameraRef.current) cameraRef.current.stop();
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setVideoVisible(false);
  };

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

  const startGame = async () => {
    setBlinkDetected(false);
    setTime(0);
    setStatus('Getting webcam ready...');
    await startWebcamStream();
    startCountdown();
  };

  const restartGame = () => {
    stopTimer();
    stopCamera();
    setStatus('Click Start to begin the staring contest');
    setBlinkDetected(false);
    setTime(0);
    setCountdown(0);
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      maxWidth: 720,
      margin: '40px auto',
      padding: 20,
      background: 'linear-gradient(145deg, #e6e6e6, #ffffff)',
      boxShadow: '12px 12px 20px #bebebe, -12px -12px 20px #ffffff',
      borderRadius: 20,
      color: '#333',
      textAlign: 'center',
    }}>
      <h1 style={{ fontWeight: '700', marginBottom: 20 }}>👀 Staring Contest Game</h1>

      <div style={{
        position: 'relative',
        width: 640,
        height: 480,
        margin: '0 auto 20px auto',
        borderRadius: 12,
        boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}>
        <video
          ref={videoRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            opacity: videoVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            objectFit: 'cover',
          }}
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
        {countdown > 0 && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ff4757',
            fontSize: 100,
            fontWeight: '900',
            userSelect: 'none',
            textShadow: '0 0 15px rgba(255,71,87,0.9)',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: 140,
            height: 140,
            lineHeight: '140px',
            boxShadow: 'inset 6px 6px 8px rgba(255,71,87,0.6), inset -6px -6px 8px rgba(255,71,87,0.4)',
          }}>
            {countdown}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={startGame}
          disabled={blinkDetected || countdown > 0}
          style={{
            cursor: blinkDetected || countdown > 0 ? 'not-allowed' : 'pointer',
            background: '#1e90ff',
            color: '#fff',
            fontWeight: '600',
            padding: '12px 28px',
            fontSize: 18,
            border: 'none',
            borderRadius: 12,
            marginRight: 15,
            boxShadow: '0 6px 12px rgba(30,144,255,0.4)',
            transition: 'background-color 0.3s ease',
          }}
          onMouseEnter={e => { if (!blinkDetected && countdown === 0) e.currentTarget.style.background = '#1c86ee'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1e90ff'; }}
        >
          Start
        </button>
        <button
          onClick={restartGame}
          style={{
            cursor: 'pointer',
            background: '#6c757d',
            color: '#fff',
            fontWeight: '600',
            padding: '12px 28px',
            fontSize: 18,
            border: 'none',
            borderRadius: 12,
            boxShadow: '0 6px 12px rgba(108,117,125,0.4)',
            transition: 'background-color 0.3s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#5a6268'}
          onMouseLeave={e => e.currentTarget.style.background = '#6c757d'}
        >
          Restart
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
        <div style={{
          background: '#f1f3f5',
          padding: '8px 18px',
          borderRadius: 20,
          fontWeight: '600',
          color: '#555',
          boxShadow: 'inset 2px 2px 5px #d1d3d5, inset -2px -2px 5px #f9fafb',
          minWidth: 140,
          userSelect: 'none',
        }}>
          Status: <span style={{ color: '#1e90ff' }}>{status}</span>
        </div>

        <div style={{
          background: '#f1f3f5',
          padding: '8px 22px',
          borderRadius: 20,
          fontWeight: '600',
          color: '#555',
          boxShadow: 'inset 2px 2px 5px #d1d3d5, inset -2px -2px 5px #f9fafb',
          minWidth: 120,
          userSelect: 'none',
        }}>
          Time: <span style={{ color: '#1e90ff' }}>{time} s</span>
        </div>
      </div>
    </div>
  );
}

export default App;
