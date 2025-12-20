// src/components/ProviderGrid.tsx
import { useState, useEffect } from "react";
import { useReclaim, type ProviderType } from "../hooks/useReclaim";
import { submitContribution, getUserPoints } from "../services/api";
import { useWallet } from "../hooks/useWallet";
import "./ProviderGrid.css";

type Provider = {
  id: ProviderType;
  label: string;
  description: string;
  icon: string;
  dataType: 'zomato_order_history' | 'github_profile' | 'netflix_watch_history';
};

const providers: Provider[] = [
  {
    id: "zomato",
    label: "Zomato",
    description: "Order History",
    icon: "🍕",
    dataType: "zomato_order_history",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Developer Profile",
    icon: "🐙",
    dataType: "github_profile",
  },
  {
    id: "netflix",
    label: "Netflix",
    description: "Watch History",
    icon: "🎬",
    dataType: "netflix_watch_history",
  },
];

type ModalState = {
  provider: Provider | null;
  step: 'idle' | 'verifying' | 'submitting' | 'success' | 'error';
  points: number;
  error: string | null;
};

export function ProviderGrid() {
  const { address } = useWallet();
  const { verify, isLoading } = useReclaim();
  const [totalPoints, setTotalPoints] = useState(0);
  const [modal, setModal] = useState<ModalState>({
    provider: null,
    step: 'idle',
    points: 0,
    error: null,
  });

  // Load user points on mount
  useEffect(() => {
    if (address) {
      getUserPoints(address).then(setTotalPoints).catch(() => { });
    }
  }, [address]);

  const handleProviderClick = async (provider: Provider) => {
    if (!address) return;

    setModal({ provider, step: 'verifying', points: 0, error: null });

    try {
      // Step 1: Reclaim verification
      const result = await verify(provider.id);

      if (!result) {
        throw new Error('Verification cancelled or failed');
      }

      // Step 2: Submit to backend
      setModal(prev => ({ ...prev, step: 'submitting' }));

      const response = await submitContribution(address, {
        anonymizedData: result.data,
        dataType: provider.dataType,
        reclaimProofId: result.proofId,
      });

      // Success!
      setModal(prev => ({
        ...prev,
        step: 'success',
        points: response.contribution.pointsAwarded,
      }));

      // Update total points
      setTotalPoints(prev => prev + response.contribution.pointsAwarded);

    } catch (err) {
      setModal(prev => ({
        ...prev,
        step: 'error',
        error: err instanceof Error ? err.message : 'Something went wrong',
      }));
    }
  };

  const closeModal = () => {
    setModal({ provider: null, step: 'idle', points: 0, error: null });
  };

  return (
    <div className="provider-grid-container">
      <div className="provider-header">
        <h2>Contribute & Earn</h2>
        <p className="provider-subtitle">
          Verify your data via Reclaim Protocol and earn points
        </p>
        {totalPoints > 0 && (
          <div className="total-points">
            💎 <strong>{totalPoints}</strong> points
          </div>
        )}
      </div>

      <div className="provider-grid">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleProviderClick(provider)}
            className="provider-card glass-card"
            disabled={isLoading}
          >
            <div className="provider-icon">{provider.icon}</div>
            <div className="provider-content">
              <h3 className="provider-label">{provider.label}</h3>
              <p className="provider-description">{provider.description}</p>
            </div>
            <div className="provider-arrow">→</div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {modal.provider && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>

            <div className="modal-icon">{modal.provider.icon}</div>
            <h3>{modal.provider.label} Verification</h3>

            {modal.step === 'verifying' && (
              <>
                <div className="spinner"></div>
                <p>Complete verification in the opened window...</p>
              </>
            )}

            {modal.step === 'submitting' && (
              <>
                <div className="spinner"></div>
                <p>Processing your data...</p>
              </>
            )}

            {modal.step === 'success' && (
              <>
                <div className="success-check">✅</div>
                <p>Verification complete!</p>
                <div className="points-earned">+{modal.points} points</div>
                <button className="btn-done" onClick={closeModal}>Done</button>
              </>
            )}

            {modal.step === 'error' && (
              <>
                <div className="error-x">❌</div>
                <p>{modal.error}</p>
                <button className="btn-done" onClick={closeModal}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}