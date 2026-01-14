// src/pages/Home.tsx
import { useState } from "react";
import { ConnectMenu } from "../components/ConnectMenu";
import { ProviderGrid } from "../components/ProviderGrid";
import { PrivacyPolicy } from "../components/PrivacyPolicy";
import { TermsConditions } from "../components/TermsConditions";
import Iridescence from "../components/DynamicBackground";
import { useWallet } from "../hooks/useWallet";

export function Home() {
  const { isConnected } = useWallet();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <main className="min-h-screen w-full relative overflow-hidden bg-white flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 opacity-30">
        <Iridescence
          color={[1.0, 1.0, 1.0]}
          mouseReact={false}
          amplitude={0.1}
          speed={0.4}
        />
      </div>
      <div className="relative z-10 w-full max-w-4xl mx-auto space-y-12 text-center">

        {/* DISCONNECTED STATE */}
        {/* DISCONNECTED STATE */}
        {!isConnected && (
          <div className="animate-fade-in space-y-12">
            <header className="space-y-6">
              <h2 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-none drop-shadow-sm">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-black">MYRAD</span>
              </h2>

              <p className="text-xl md:text-2xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed tracking-tight">
                We let you earn from your digital activities without giving up your privacy
              </p>
            </header>

            <section className="flex justify-center pt-8">
              <ConnectMenu />
            </section>
          </div>
        )}

        {/* CONNECTED STATE */}
        {isConnected && (
          <section className="animate-fade-in w-full text-left space-y-4">
            <div className="flex justify-end">
              <div className="bg-white/80 backdrop-blur-md rounded-xl p-1 shadow-sm border border-white/50">
                <ConnectMenu />
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-lg rounded-3xl p-4 md:p-8 shadow-xl shadow-slate-200/50 border border-white/50">
              <ProviderGrid />
            </div>
          </section>
        )}

        {/* Footer Privacy Link (always visible) */}
        <div className="flex items-center justify-center space-x-4 text-sm text-slate-400 font-medium pt-12 pb-6">
          <button
            className="hover:text-slate-900 transition-colors"
            onClick={() => setShowPrivacy(true)}
          >
            Privacy Policy
          </button>

          <span className="text-slate-300">|</span>

          <button
            className="hover:text-slate-900 transition-colors"
            onClick={() => setShowTerms(true)}
          >
            Terms & Conditions
          </button>
        </div>

        {/* Privacy Modal */}
        <PrivacyPolicy
          open={showPrivacy}
          onClose={() => setShowPrivacy(false)}
        />

        <TermsConditions
          open={showTerms}
          onClose={() => setShowTerms(false)}
        />
      </div>
    </main>
  );
}
