// src/App.tsx
import { useEffect } from "react";
import { Home } from "./pages/Home";
import { initFarcasterMiniApp } from "./config/farcaster";

function App() {
  useEffect(() => {
    // Initialize Farcaster mini app (safe in browser + viewer)
    initFarcasterMiniApp();
  }, []);

  return <Home />;
}

export default App;
