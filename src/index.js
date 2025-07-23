import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import BarcodePartMatcher from "./BarcodePartMatcher";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BarcodePartMatcher />
  </React.StrictMode>
);