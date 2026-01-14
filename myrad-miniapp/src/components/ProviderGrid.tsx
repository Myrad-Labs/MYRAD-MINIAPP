// src/components/ProviderGrid.tsx
import { useState, useEffect } from "react";
import { useReclaim, type ProviderType } from "../hooks/useReclaim";
import { submitContribution, getUserPoints } from "../services/api";
import { useWallet } from "../hooks/useWallet";
import { CheckCircle2, XCircle, ArrowRight, Loader2, X, Trophy } from "lucide-react";

import github from "../assets/github.png";
import zomato from "../assets/zomato.png";
import netflix from "../assets/netflix.png";

type Provider = {
  id: ProviderType;
  label: string;
  description: string;
  icon: string;
  dataType:
  | "zomato_order_history"
  | "github_profile"
  | "netflix_watch_history";
};

const providers: Provider[] = [
  {
    id: "zomato",
    label: "Zomato",
    description: "Order History",
    dataType: "zomato_order_history",
    icon: zomato,
  },
  {
    id: "github",
    label: "GitHub",
    description: "Developer Profile",
    dataType: "github_profile",
    icon: github,
  },
  {
    id: "netflix",
    label: "Netflix",
    description: "Watch History",
    dataType: "netflix_watch_history",
    icon: netflix,
  },
];

type ModalState = {
  provider: Provider | null;
  step: "idle" | "verifying" | "submitting" | "success" | "error";
  points: number;
  error: string | null;
};

type ProviderPoints = {
  [key in ProviderType]?: number;
};

export function ProviderGrid() {
  const { address } = useWallet();
  const {
    startVerification,
    checkForResult,
    cancelVerification,
    isLoading,
    getPendingVerification
  } = useReclaim();

  const [totalPoints, setTotalPoints] = useState(0);
  const [providerPoints, setProviderPoints] = useState<ProviderPoints>({});
  const [modal, setModal] = useState<ModalState>({
    provider: null,
    step: "idle",
    points: 0,
    error: null,
  });

  // Load total user points
  useEffect(() => {
    if (address) {
      getUserPoints(address)
        .then(setTotalPoints)
        .catch(() => { });
    }
  }, [address]);

  // Check for pending verification results on mount and focus
  useEffect(() => {
    const checkPending = async () => {
      const pending = getPendingVerification();
      if (!pending || !address) return;

      console.log('📋 Found pending verification, checking for result...');

      // Find the provider
      const provider = providers.find(p => p.id === pending.provider);
      if (!provider) return;

      // Show the modal in submitting state
      setModal({ provider, step: "submitting", points: 0, error: null });

      const result = await checkForResult();

      if (result) {
        console.log('✅ Found completed verification result');
        try {
          const response = await submitContribution(address, {
            anonymizedData: result.data,
            dataType: provider.dataType,
            reclaimProofId: result.proofId,
          });

          const earned = response.contribution.pointsAwarded;

          setModal((prev) => ({
            ...prev,
            step: "success",
            points: earned,
          }));

          setTotalPoints((prev) => prev + earned);
          setProviderPoints((prev) => ({
            ...prev,
            [provider.id]: (prev[provider.id] || 0) + earned,
          }));
        } catch (err) {
          setModal((prev) => ({
            ...prev,
            step: "error",
            error: err instanceof Error ? err.message : "Submission failed",
          }));
        }
      } else {
        // No result yet, keep polling
        console.log('⏳ No result yet, will keep checking...');
      }
    };

    // Check immediately on mount
    checkPending();

    // Also check on visibility change (when user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(checkPending, 1000); // Small delay
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Poll every 3 seconds while component is mounted
    const interval = setInterval(checkPending, 3000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [address, checkForResult, getPendingVerification]);

  const handleProviderClick = async (provider: Provider) => {
    if (!address) return;

    setModal({ provider, step: "verifying", points: 0, error: null });

    // Start verification - this opens the external URL
    const started = await startVerification(provider.id);

    if (!started) {
      setModal((prev) => ({
        ...prev,
        step: "error",
        error: "Failed to start verification",
      }));
    }
    // After starting, the user will navigate away
    // The useEffect above will handle checking for results when they return
  };

  const closeModal = () => {
    cancelVerification();
    setModal({ provider: null, step: "idle", points: 0, error: null });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Contribute & Earn</h2>
          <p className="text-slate-500 text-sm">
            Verify data via Reclaim Protocol to earn
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <Trophy className="text-amber-500 fill-amber-500" size={18} />
          <div className="flex items-baseline gap-1">
            <strong className="text-xl font-black text-slate-900">{totalPoints.toLocaleString()}</strong>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PTS</span>
          </div>
        </div>
      </div>

      {/* Provider Grid - Compact vertical list for mobile, grid for desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const claimed = !!providerPoints[provider.id];

          return (
            <button
              key={provider.id}
              onClick={() => handleProviderClick(provider)}
              disabled={isLoading || claimed}
              className="group relative flex flex-row items-center w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg bg-slate-50 p-2 shadow-inner shrink-0 mr-4">
                <img
                  src={provider.icon}
                  alt={provider.label}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Text */}
              <div className="text-left flex-grow min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">{provider.label}</h3>
                <p className="text-slate-500 font-medium text-xs truncate">
                  {provider.description}
                </p>
              </div>

              {/* Action/Status */}
              <div className="ml-3 shrink-0">
                <div className={`p-1.5 rounded-full transition-colors ${claimed ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-50 group-hover:text-amber-500 group-hover:bg-amber-50'}`}>
                  {claimed ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}
                </div>
              </div>

              {claimed && (
                <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-emerald-100/90 backdrop-blur-sm text-emerald-700 text-[10px] font-bold rounded-full shadow-sm">
                  <span>+{providerPoints[provider.id]}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {modal.provider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              onClick={closeModal}
            >
              <X size={20} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl p-4 mb-6 shadow-inner">
                <img
                  src={modal.provider.icon}
                  alt={modal.provider.label}
                  className="w-full h-full object-contain"
                />
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {modal.provider.label} Verification
              </h3>

              {modal.step === "verifying" && (
                <div className="py-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                  <Loader2 size={48} className="text-slate-900 animate-spin mb-4" strokeWidth={1.5} />
                  <p className="text-slate-600 font-medium">Please complete the verification process in the popup window...</p>
                </div>
              )}

              {modal.step === "submitting" && (
                <div className="py-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                  <div className="relative mb-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-slate-600 font-medium">Verifying your proof and calculating rewards...</p>
                </div>
              )}

              {modal.step === "success" && (
                <div className="py-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 w-full">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} strokeWidth={3} />
                  </div>
                  <p className="text-slate-600 font-medium mb-6">Verification successful! Your contribution has been recorded.</p>

                  <div className="bg-amber-50 text-amber-700 px-6 py-3 rounded-xl font-bold text-lg mb-8 border border-amber-100 w-full">
                    +{modal.points} Points Earned
                  </div>

                  <button
                    className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    onClick={closeModal}
                  >
                    Awesome
                  </button>
                </div>
              )}

              {modal.step === "error" && (
                <div className="py-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 w-full">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                    <XCircle size={32} strokeWidth={3} />
                  </div>
                  <p className="text-rose-600 font-medium mb-8 bg-rose-50 px-4 py-3 rounded-xl w-full">
                    {modal.error}
                  </p>
                  <button
                    className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
