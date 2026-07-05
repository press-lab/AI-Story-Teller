import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ActionFeedbackProvider } from "./components/ActionFeedback";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ActionFeedbackProvider>
      <App />
    </ActionFeedbackProvider>
  </StrictMode>,
);
