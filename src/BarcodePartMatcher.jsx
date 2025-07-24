import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import * as tf from "@tensorflow/tfjs";

const BarcodePartMatcher = () => {
  const [barcodeData, setBarcodeData] = useState("");
  const [partMatchResult, setPartMatchResult] = useState("");
  const [step, setStep] = useState(0);
  const [model, setModel] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const partVideoRef = useRef(null);
  const partCanvasRef = useRef(null);

  useEffect(() => {
    const loadModel = async () => {
      const loadedModel = await tf.loadLayersModel("/model/model.json");
      setModel(loadedModel);
    };
    loadModel();
  }, []);

  const startQRScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      scanQRCode();
    } catch (error) {
      console.error("Camera access failed:", error);
      alert("Camera access was denied or failed. Please allow camera access and reload the page.");
    }
  };

  const scanQRCode = () => {
    const scan = () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) {
        requestAnimationFrame(scan);
        return;
      }

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setBarcodeData(code.data);
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        setStep(2);
        startPartCamera();
      } else {
        requestAnimationFrame(scan);
      }
    };
    scan();
  };

  const startPartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      partVideoRef.current.srcObject = stream;
      partVideoRef.current.play();
    } catch (error) {
      console.error("Camera access failed:", error);
      alert("Camera access was denied or failed. Please allow camera access and reload the page.");
    }
  };

  const capturePartPhoto = () => {
    const canvas = partCanvasRef.current;
    const context = canvas.getContext("2d");
    canvas.width = partVideoRef.current.videoWidth;
    canvas.height = partVideoRef.current.videoHeight;
    context.drawImage(partVideoRef.current, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const tensor = tf.browser.fromPixels(imageData)
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .expandDims();

    if (model) {
      const prediction = model.predict(tensor);
      prediction.array().then(predictions => {
        const matchScore = predictions[0][0];
        const threshold = 0.5;
        const result = matchScore > threshold ? "Match" : "No Match";
        setPartMatchResult(`${result} (Score: ${matchScore.toFixed(2)})`);
        partVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        setStep(3);
      });
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Barcode-Part Matcher</h1>

      {step === 0 && (
        <button
          onClick={() => {
            setStep(1);
            startQRScanner();
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded mx-auto block"
        >
          Start
        </button>
      )}

      {step === 1 && (
        <div>
          <video
            ref={videoRef}
            className="w-full h-auto border"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <p className="text-center mt-2">Scanning QR Code...</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-center mb-2">QR Code: <strong>{barcodeData}</strong></p>
          <video
            ref={partVideoRef}
            className="w-full h-auto border"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={partCanvasRef} style={{ display: "none" }} />
          <button
            onClick={capturePartPhoto}
            className="bg-green-500 text-white px-4 py-2 mt-2 rounded mx-auto block"
          >
            Capture Part Photo
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <p className="mb-2">QR Code: <strong>{barcodeData}</strong></p>
          <p className="text-xl font-semibold">{partMatchResult}</p>
        </div>
      )}
    </div>
  );
};

export default BarcodePartMatcher;
