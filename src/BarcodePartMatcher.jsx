
import React, { useState, useRef, useEffect } from "react";
import { BrowserQRCodeReader } from "@zxing/library";
import * as tmImage from "@teachablemachine/image";

export default function BarcodePartMatcher() {
  const [step, setStep] = useState(0);
  const [qrText, setQRText] = useState("");
  const [predictedClass, setPredictedClass] = useState("");
  const [result, setResult] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);

  const resetApp = () => {
    setStep(0);
    setQRText("");
    setPredictedClass("");
    setResult("");
    setCapturedImage(null);
    setError(null);
    stopCamera();
  };

  const stopCamera = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  };

const getCameraStream = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInput = devices.find(
      (device) =>
        device.kind === "videoinput" &&
        device.label.toLowerCase().includes("back")
    );

    const constraints = {
      video: videoInput
        ? { deviceId: { exact: videoInput.deviceId } }
        : { facingMode: { ideal: "environment" } },
      audio: false,
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.error("Camera error:", err);
    return null;
  }
};


  const startQRScanner = async () => {
    setStep(1);
    stopCamera();

    const video = videoRef.current;
    const stream = await getRearCameraStream();
    if (!stream) return;

    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.muted = true;

    try {
      await video.play();
    } catch (e) {
      setError("Unable to start video playback.");
      return;
    }

    const qrReader = new BrowserQRCodeReader();
    const interval = setInterval(async () => {
      try {
        const result = await qrReader.decodeOnceFromVideoElement(video);
        if (result) {
          setQRText(result.getText());
          clearInterval(interval);
          stopCamera();
          setStep(2);
        }
      } catch {
        // No QR found yet; keep scanning.
      }
    }, 1000);
  };

  const startPartCamera = async () => {
    stopCamera();

    const video = videoRef.current;
    const stream = await getRearCameraStream();
    if (!stream) return;

    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.muted = true;

    try {
      await video.play();
    } catch (e) {
      setError("Unable to start video playback for part photo.");
    }
  };

  const loadModel = async () => {
    try {
      const URL = "/model";
      const modelURL = `${URL}/model.json`;
      const metadataURL = `${URL}/metadata.json`;
      const model = await tmImage.load(modelURL, metadataURL);
      modelRef.current = model;
    } catch (err) {
      console.error("Model load failed", err);
    }
  };

  const capturePartImage = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    setCapturedImage(imageData);

    const image = new Image();
    image.src = imageData;
    await new Promise((res) => (image.onload = res));

    const prediction = await modelRef.current.predict(image);
    const best = prediction.sort((a, b) => b.probability - a.probability)[0];
    setPredictedClass(best.className);
    setResult(best.className === qrText ? "Match" : "Incorrect");

    stopCamera();
    setStep(3);
  };

  useEffect(() => {
    loadModel();
  }, []);

  useEffect(() => {
    if (step === 2) {
      startPartCamera();
    }
  }, [step]);

  const resultStyle =
    result === "Match" ? "bg-green-200" : result === "Incorrect" ? "bg-red-200" : "";

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">QR Code-Part Matcher</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {step === 0 && (
        <div>
          <p className="mb-4">Press Start to begin scanning a QR code.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={startQRScanner}>
            Start
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-2">Step 1: Scan the QR Code</p>
          <video ref={videoRef} className="w-full border" autoPlay playsInline muted />
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-2">Step 2: Take a photo of the part</p>
          <video ref={videoRef} className="w-full border mb-2" autoPlay playsInline muted />
          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={capturePartImage}>
            Capture Part Photo
          </button>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {step === 3 && (
        <div className={`p-4 rounded ${resultStyle}`}>
          <p className="text-lg font-semibold">Result: {result}</p>
          {capturedImage && <img src={capturedImage} className="w-full mt-2 border" alt="Captured Part" />}
          <p className="text-sm text-gray-600 mt-2">QR Code: {qrText}</p>
          <p className="text-sm text-gray-600">Predicted: {predictedClass}</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={resetApp}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
