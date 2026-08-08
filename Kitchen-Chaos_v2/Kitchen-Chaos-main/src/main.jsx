import React from "react";
import ReactDOM from "react-dom/client";
import { PortalProvider } from "@portalsdk/react";
import App from "./App.jsx";
import { portal } from "./lib/portal.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortalProvider client={portal}>
      <App />
    </PortalProvider>
  </React.StrictMode>
);
