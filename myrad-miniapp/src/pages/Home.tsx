// src/pages/Home.tsx
import { useState } from "react";
import { ConnectMenu } from "../components/ConnectMenu";
import { ProviderGrid } from "../components/ProviderGrid";
import { PrivacyPolicy } from "../components/PrivacyPolicy";
import { TermsConditions } from "../components/TermsConditions";
import { useWallet } from "../hooks/useWallet";
import "./Home.css";

export function Home() {
  const { isConnected } = useWallet();
  const [showPrivacy, setShowPrivacy] = useState(false);
const [showTerms, setShowTerms] = useState(false);

  return (
    <main className="home-container">
      <div className="home-content">

        {/* DISCONNECTED STATE */}
        {!isConnected && (
          <div className="disconnected-layout">
            <header className="hero-section">
              <h1 className="hero-title">
                Welcome to <span className="gradient-text">MYRAD</span>
              </h1>

              <p className="hero-description">
                Connect your wallet to unlock personalized insights and
                contribute your opinions to earn rewards.
              </p>
            </header>

            <section className="connect-section">
              <ConnectMenu />
            </section>
          </div>
        )}

        {/* CONNECTED STATE */}
        {isConnected && (
          <section className="connected-section">
            <ConnectMenu />
            <br />
            <ProviderGrid />
          </section>
        )}
        {/* Footer Privacy Link (always visible) */}
<div className="privacy-center">
  <button
    className="privacy-link"
    onClick={() => setShowPrivacy(true)}
  >
    Privacy Policy
  </button>

  <span style={{ margin: "0 10px" }}>|</span>

  <button
    className="privacy-link"
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
