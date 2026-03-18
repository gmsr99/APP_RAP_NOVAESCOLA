import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Registar Service Worker para Web Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure is non-critical
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
