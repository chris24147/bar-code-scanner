import React, { useState, useRef, useEffect } from "react";
import { BrowserQRCodeReader } from "@zxing/library";
import * as tmImage from "@teachablemachine/image";

export default function BarcodePartMatcher() {
  const [step, setStep] = useState(0);
  const [qrText, setQRText] = useState("");
  const [predictedClass, setPredictedClass] = useState("");
  const [result, setResult] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const qrReaderRef = useRef(null);

  const resetApp = () => {
    setStep(0);
    setQRText("");
    setPredictedClass("");
    setResult("");
    setCapturedImage(null);
    if (qrReaderRef.current) {
      qrReaderRef.current.reset();
    }
    stopCamera();
  };

  const getCameraStream = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
    }
  };

  const stopCamera = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  };

  const startQRScanner = async () => {
    setStep(1);
    await new Promise((resolve) => {
      const check = () => {
        if (videoRef.current) resolve();
        else setTimeout(check, 50);
      };
      check();
    });

    const videoElement = videoRef.current;

    try {
      stopCamera();
      const stream = await getCameraStream();
      videoElement.srcObject = stream;

      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");
      videoElement.setAttribute("muted", "true");
      videoElement.muted = true;

      await videoElement.play();

      const qrReader = new BrowserQRCodeReader();
      qrReaderRef.current = qrReader;

      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const rearCamera =
        devices.find((device) =>
          device.label.toLowerCase().includes("back")
        ) || devices[0];

      qrReader.decodeFromVideoDevice(
        rearCamera.deviceId,
        videoElement,
        (result, err) => {
          if (result) {
            setQRText(result.getText());
            qrReader.reset();
            stopCamera();
            setStep(2);
          }
        }
      );
    } catch (error) {
      alert("Failed to access camera: " + error.message);
      console.error("QR scanning failed:", error);
    }
  };

  const startPartCamera = async () => {
    const videoElement = videoRef.current;

    try {
      stopCamera();
      const stream = await getCameraStream();
      videoElement.srcObject = stream;

      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");
      videoElement.setAttribute("muted", "true");
      videoElement.muted = true;

      await videoElement.play();

      await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => resolve();
      });
    } catch (error) {
      console.error("Camera access for part photo failed:", error);
    }
  };

  const loadModel = async () => {
    try {
      const URL = "/model";
      const modelURL = URL + "/model.json";
      const metadataURL = URL + "/metadata.json";
      const model = await tmImage.load(modelURL, metadataURL);
      modelRef.current = model;
    } catch (error) {
      console.error("Model load failed:", error);
    }
  };

  const capturePartImage = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataURL = canvas.toDataURL("image/png");
    setCapturedImage(imageDataURL);

    const image = new Image();
    image.src = imageDataURL;
    await new Promise((resolve) => (image.onload = resolve));

    try {
      const prediction = await modelRef.current.predict(image);
      const top = prediction.sort((a, b) => b.probability - a.probability)[0];
      setPredictedClass(top.className);
      setResult(top.className === qrText ? "Match" : "Incorrect");
    } catch (error) {
      console.error("Prediction failed:", error);
    }

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

  const resultClass =
    result === "Match" ? "bg-green-200" : result === "Incorrect" ? "bg-red-200" : "";

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">QR Code-Part Matcher</h1>

      {step === 0 && (
        <div>
          <p className="mb-4">Welcome. Press start to begin QR code scanning.</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={startQRScanner}
          >
            Start
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-2">Step 1: Scan QR Code</p>
          <video
            ref={videoRef}
            className="w-full h-auto border"
            style={{ filter: "contrast(1.2) brightness(1.1)" }}
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-2">Step 2: Take a photo of the part</p>
          <video
            ref={videoRef}
            className="w-full h-auto border mb-2"
            autoPlay
            playsInline
            muted
          />
          <button
            className="px-4 py-2 bg-green-600 text-white rounded"
            onClick={capturePartImage}
          >
            Capture Part Photo
          </button>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {step === 3 && (
        <div className={`p-4 rounded ${resultClass}`}>
          <p className="text-lg font-semibold">Result: {result}</p>
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured Part"
              className="w-full mt-2 border"
            />
          )}
          <p className="text-sm text-gray-600 mt-2">QR Code: {qrText}</p>
          <p className="text-sm text-gray-600">Predicted Class: {predictedClass}</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={resetApp}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
