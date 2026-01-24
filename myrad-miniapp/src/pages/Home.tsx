// src/pages/Home.tsx
import { useState } from "react";
import { ConnectMenu } from "../components/ConnectMenu";
import { ProviderGrid } from "../components/ProviderGrid";
import { PrivacyPolicy } from "../components/PrivacyPolicy";
import { TermsConditions } from "../components/TermsConditions";
import Iridescence from "../components/DynamicBackground";
import Leaderboard from "../components/Leaderboard";

import { useWallet } from "../hooks/useWallet";

export function Home() {
  const { isConnected } = useWallet();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [activePage, setActivePage] =
    useState<"providers" | "leaderboard">("providers");

  return (
    <main className="min-h-screen w-full relative overflow-hidden bg-white flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 opacity-30">
        <Iridescence
          color={[1.0, 1.0, 1.0]}
          mouseReact={false}
          amplitude={0.1}
          speed={0.4}
        />
      </div>

      {/* Page Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center space-y-12">

        {/* DISCONNECTED */}
        {!isConnected && (
          <div className="animate-fade-in text-center space-y-12">
            <header className="space-y-6">
              <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-black">
                  MYRAD
                </span>
              </h2>

              <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto">
                We let you earn from your digital activities without giving up
                your privacy
              </p>
            </header>

            <ConnectMenu />
          </div>
        )}

        {/* CONNECTED */}
        {isConnected && (
          <section className="animate-fade-in w-full space-y-8">

            {/* Wallet */}
{/* Wallet */}
<div className="flex justify-center">
  <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 border border-slate-200 shadow-sm">
    <ConnectMenu />
  </div>
</div>


            {/* Tabs */}
            <div className="flex justify-center">
              <div className="flex gap-2 bg-white/80 backdrop-blur-md rounded-2xl p-1 border border-slate-200 shadow-sm">
                <button
                  onClick={() => setActivePage("providers")}
                  className={`px-6 py-2 rounded-xl text-sm font-semibold transition ${
                    activePage === "providers"
                      ? "bg-black text-white shadow"
                      : "text-slate-600 hover:text-black"
                  }`}
                >
                  Providers
                </button>

                <button
                  onClick={() => setActivePage("leaderboard")}
                  className={`px-6 py-2 rounded-xl text-sm font-semibold transition ${
                    activePage === "leaderboard"
                      ? "bg-black text-white shadow"
                      : "text-slate-600 hover:text-black"
                  }`}
                >
                  Leaderboard
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="mx-auto w-full max-w-4xl bg-white/80 backdrop-blur-lg rounded-3xl p-6 md:p-8 border border-white/50 shadow-xl shadow-slate-200/50">
              {activePage === "providers" && <ProviderGrid />}
              {activePage === "leaderboard" && <Leaderboard />}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="flex items-center gap-4 text-sm text-slate-400 pt-12">
          <button
            className="hover:text-slate-900 transition"
            onClick={() => setShowPrivacy(true)}
          >
            Privacy Policy
          </button>
          <span>|</span>
          <button
            className="hover:text-slate-900 transition"
            onClick={() => setShowTerms(true)}
          >
            Terms & Conditions
          </button>
        </footer>

        <PrivacyPolicy open={showPrivacy} onClose={() => setShowPrivacy(false)} />
        <TermsConditions open={showTerms} onClose={() => setShowTerms(false)} />
      </div>
    </main>
  );
}
