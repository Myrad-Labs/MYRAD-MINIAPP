// src/hooks/useWallet.ts
import { useAccount, useConnect, useDisconnect } from "wagmi";

export const useWallet = () => {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return {
    isConnected,
    address,
    connect,
    connectors,
    isConnecting: isPending,
    disconnect,
  };
};
