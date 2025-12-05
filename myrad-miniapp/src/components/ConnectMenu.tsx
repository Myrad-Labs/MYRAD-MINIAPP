// src/components/ConnectMenu.tsx
import { useWallet } from "../hooks/useWallet";
import "./ConnectMenu.css";

export function ConnectMenu() {
  const {
    isConnected,
    address,
    connect,
    connectors,
    isConnecting,
    disconnect,
  } = useWallet();

  if (isConnected) {
    return (
      <div className="wallet-connected-badge">
        <div className="wallet-info">
          <span className="status-dot-small"></span>
          <code className="address-compact">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
          </code>
        </div>
        
        <button
          onClick={() => disconnect()}
          className="disconnect-btn-compact"
          title="Disconnect Wallet"
        >
          <span>Disconnect</span>
        </button>
      </div>
    );
  }

  const handleConnect = () => {
    if (connectors && connectors[0]) {
      connect({ connector: connectors[0] });
    } else {
      alert("No wallet connector found");
    }
  };

  return (
    <div className="wallet-connect-container">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className={`btn-primary connect-btn ${isConnecting ? 'loading' : ''}`}
      >
        {isConnecting ? (
          <>
            <span className="loading-spinner"></span>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <span className="wallet-icon">👛</span>
            <span>Connect Wallet</span>
          </>
        )}
      </button>
      
      <p className="connect-hint">
        Connect your wallet to get started
      </p>
    </div>
  );
}