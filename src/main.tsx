import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ActionFeedbackProvider } from "./components/ActionFeedback";
import App from "./App";
import { startClientPerformanceMonitoring } from "./runtime/clientPerformanceMonitor";
import "./styles.css";
import "./studio-refinement.css";
import "./play-docs-refinement.css";

startClientPerformanceMonitoring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ActionFeedbackProvider>
      <App />
    </ActionFeedbackProvider>
  </StrictMode>,
);
