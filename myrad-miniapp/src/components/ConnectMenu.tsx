// src/components/ConnectMenu.tsx
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
      <div className="flex items-center gap-2 sm:gap-4 bg-white/80 backdrop-blur-md px-3 py-2 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-100/50 transition-all hover:shadow-xl hover:border-slate-300/60 max-w-full">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></div>
          </div>

          {address && (
            <div className="flex items-center gap-2 sm:gap-3">
              <code className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-50 text-slate-600 font-mono text-xs sm:text-sm font-medium border border-slate-100 select-all truncate max-w-[120px] sm:max-w-none">
                {formatAddress(address)}
              </code>

              <button
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-95 shrink-0"
                onClick={() => navigator.clipboard.writeText(address)}
                title="Copy wallet address"
              >
                <Copy size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-4 sm:h-6 bg-slate-200 shrink-0"></div>

        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-rose-600 bg-rose-50/50 hover:bg-rose-100/80 rounded-xl transition-all active:scale-95 shrink-0"
          title="Disconnect Wallet"
        >
          <LogOut size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Disconnect</span>
          <span className="inline sm:hidden">Exit</span>
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
