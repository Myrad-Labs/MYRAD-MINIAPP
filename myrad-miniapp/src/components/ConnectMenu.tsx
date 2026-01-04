// src/components/ConnectMenu.tsx
import { useWallet } from "../hooks/useWallet";
import { Copy } from "lucide-react";
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

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 12)}.....${addr.slice(-10)}`;
  };

  if (isConnected) {
    return (
      <div className="wallet-connected-badge">
        <div className="wallet-info">
          <span className="status-dot-small"></span>

          {address && (
            <div className="wallet-address-row">
              <code className="address-compact">
                {formatAddress(address)}
              </code>

              <button
                className="copy-btn-icon"
                onClick={() => navigator.clipboard.writeText(address)}
                title="Copy wallet address"
              >
                <Copy size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => disconnect()}
          className="disconnect-btn-compact"
          title="Disconnect Wallet"
        >
          Disconnect
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
        className={`btn-primary connect-btn ${isConnecting ? "loading" : ""}`}
      >
        {isConnecting ? (
          <>
            <span className="loading-spinner"></span>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <span className="wallet-icon"></span>
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
