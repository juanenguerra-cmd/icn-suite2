import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IcnStoreProvider } from "./store/icnStore";
import "./styles/icn.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <IcnStoreProvider>
        <App />
      </IcnStoreProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
