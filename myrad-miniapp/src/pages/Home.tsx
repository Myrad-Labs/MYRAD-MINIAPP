// src/pages/Home.tsx
import { ConnectMenu } from "../components/ConnectMenu";
import { ProviderGrid } from "../components/ProviderGrid";
import { useWallet } from "../hooks/useWallet";
import "./Home.css";

export function Home() {
  const { isConnected } = useWallet();

  return (
    <main className="home-container">
      <div className="home-content">
        {/* Hero Section */}
        <header className="hero-section">
          {isConnected ? (
            <ConnectMenu />
          ) : (
            <div className="hero-badge">
              <span className="badge-icon">⚡</span>
              <span>Powered by Farcaster</span>
            </div>
          )}
          
          <h1 className="hero-title">
            Welcome to <span className="gradient-text">MYRAD</span>
          </h1>
          
          <p className="hero-description">
            Connect your wallet to unlock personalized insights and contribute your opinions to earn rewards.
          </p>
        </header>

        {/* Wallet Connection Section - Only show when not connected */}
        {!isConnected && (
          <section className="connect-section">
            <ConnectMenu />
          </section>
        )}

        {/* Provider Grid - Only shown when connected */}
        {isConnected && (
          <section className="providers-section">
            <ProviderGrid />
          </section>
        )}

        {/* Features Section - Only shown when not connected */}
        {!isConnected && (
          <section className="features-section">
            <div className="features-grid">
              <div className="feature-card glass-card">
                <div className="feature-icon">🔐</div>
                <h3>Secure Connection</h3>
                <p>Your wallet stays safe with industry-standard security protocols</p>
              </div>
              
              <div className="feature-card glass-card">
                <div className="feature-icon">💎</div>
                <h3>Earn Rewards</h3>
                <p>Get rewarded for sharing your valuable opinions and insights</p>
              </div>
              
              <div className="feature-card glass-card">
                <div className="feature-icon">📊</div>
                <h3>Track History</h3>
                <p>Access your order history across multiple platforms in one place</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}