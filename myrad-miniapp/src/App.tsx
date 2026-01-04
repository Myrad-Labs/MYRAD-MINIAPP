// src/App.tsx
import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Loader } from "./components/Loader";
import { initFarcasterMiniApp } from "./config/farcaster";

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize Farcaster mini app (safe in browser + viewer)
    initFarcasterMiniApp();

    // Show loader for 3 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return <Home />;
}

export default App;