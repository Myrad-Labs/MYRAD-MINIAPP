import { useWallet } from "../hooks/useWallet";
import { Copy, Wallet, LogOut, Loader2 } from "lucide-react";

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
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

if (isConnected) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
      
      {/* Address */}
      {address && (
        <span className="text-sm font-mono text-slate-700">
          {formatAddress(address)}
        </span>
      )}

      {/* Divider */}
      <span className="w-px h-4 bg-slate-300" />

      {/* Copy */}
      <button
        onClick={() => navigator.clipboard.writeText(address!)}
        title="Copy address"
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
      >
        <Copy size={14} strokeWidth={2.2} />
      </button>

{/* Disconnect */}
<button
  onClick={() => disconnect()}
  title="Disconnect wallet"
  className="p-1.5 rounded-md text-rose-600 bg-rose-50 
             hover:bg-rose-100 hover:text-rose-700
             active:bg-rose-200 transition"
>
  <LogOut size={15} strokeWidth={2.4} />
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
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white text-base font-bold rounded-2xl shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none transition-all duration-200"
      >
        {isConnecting ? (
          <>
            <Loader2 size={20} className="animate-spin text-slate-400" />
            <span className="text-slate-300">Connecting...</span>
          </>
        ) : (
          <>
            <Wallet size={20} className="text-slate-300 group-hover:text-white transition-colors" />
            <span>Connect Wallet</span>
          </>
        )}

        {/* Shine effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    </div>
  );
}
