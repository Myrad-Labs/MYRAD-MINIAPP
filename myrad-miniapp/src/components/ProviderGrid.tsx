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
  const { verify, isLoading } = useReclaim();

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

  const handleProviderClick = async (provider: Provider) => {
    if (!address) return;

    setModal({ provider, step: "verifying", points: 0, error: null });

    try {
      // Step 1: Reclaim verification
      const result = await verify(provider.id);
      if (!result) throw new Error("Verification cancelled or failed");

      // Step 2: Submit to backend
      setModal((prev) => ({ ...prev, step: "submitting" }));

      const response = await submitContribution(address, {
        anonymizedData: result.data,
        dataType: provider.dataType,
        reclaimProofId: result.proofId,
      });

      const earned = response.contribution.pointsAwarded;

      // Success modal
      setModal((prev) => ({
        ...prev,
        step: "success",
        points: earned,
      }));

      // Update total points
      setTotalPoints((prev) => prev + earned);

      // Update provider-specific points
      setProviderPoints((prev) => ({
        ...prev,
        [provider.id]: (prev[provider.id] || 0) + earned,
      }));
    } catch (err) {
      setModal((prev) => ({
        ...prev,
        step: "error",
        error: err instanceof Error ? err.message : "Something went wrong",
      }));
    }
  };

  const closeModal = () => {
    setModal({ provider: null, step: "idle", points: 0, error: null });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Contribute & Earn</h2>
          <p className="text-slate-500 mt-1">
            Verify your data via Reclaim Protocol and earn points
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-slate-200 shadow-sm">
          <Trophy className="text-amber-500 fill-amber-500" size={20} />
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl font-black text-slate-900">{totalPoints.toLocaleString()}</strong>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Points</span>
          </div>
        </div>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => {
          const claimed = !!providerPoints[provider.id];

          return (
            <button
              key={provider.id}
              onClick={() => handleProviderClick(provider)}
              disabled={isLoading || claimed}
              className="group relative flex flex-col items-start w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 disabled:opacity-60 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              <div className="flex justify-between w-full mb-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 p-3 shadow-inner">
                  <img
                    src={provider.icon}
                    alt={provider.label}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className={`p-2 rounded-full transition-colors ${claimed ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-50 group-hover:text-amber-500 group-hover:bg-amber-50'}`}>
                  {claimed ? <CheckCircle2 size={24} /> : <ArrowRight size={24} />}
                </div>
              </div>

              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 mb-1">{provider.label}</h3>
                <p className="text-slate-500 font-medium text-sm">
                  {provider.description}
                </p>
              </div>

              {claimed && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  <CheckCircle2 size={12} />
                  <span>+{providerPoints[provider.id]} PTS</span>
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
