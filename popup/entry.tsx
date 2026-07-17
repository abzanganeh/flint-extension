import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup.js";

const COLLAPSE_MESSAGE_TYPE = "FLINT_FLOATING_COLLAPSE";

// When hosted in the floating drawer iframe, Escape never reaches the parent
// document — bridge it so the shell can collapse to the logo.
if (window.parent !== window) {
  document.documentElement.classList.add("flint-in-drawer");
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    window.parent.postMessage({ type: COLLAPSE_MESSAGE_TYPE }, "*");
  });
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
  );
}
