// src/hooks/useReclaim.ts
// Hook for Reclaim Protocol verification with localStorage persistence for mini-apps

import { useState, useCallback, useEffect } from 'react';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
import sdk from '@farcaster/miniapp-sdk';
import { useWallet } from './useWallet';

const RECLAIM_APP_ID = import.meta.env.VITE_RECLAIM_APP_ID;
const RECLAIM_APP_SECRET = import.meta.env.VITE_RECLAIM_APP_SECRET;
const ZOMATO_PROVIDER_ID = import.meta.env.VITE_ZOMATO_PROVIDER_ID;
const GITHUB_PROVIDER_ID = import.meta.env.VITE_GITHUB_PROVIDER_ID;
const NETFLIX_PROVIDER_ID = import.meta.env.VITE_NETFLIX_PROVIDER_ID;

// Auto-detect API URL: use env var in dev, or current origin in production
const API_URL = import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

const PENDING_KEY = 'myrad_pending_verification';

export type ProviderType = 'zomato' | 'github' | 'netflix';

const DATA_TYPE_MAP: Record<ProviderType, string> = {
    zomato: 'zomato_order_history',
    github: 'github_profile',
    netflix: 'netflix_watch_history'
};

export interface ReclaimResult {
    proofId: string;
    data: Record<string, unknown>;
    dataType?: string;
}

export interface PendingVerification {
    provider: ProviderType;
    walletAddress: string;
    startedAt: number;
}

// Check for pending contribution from backend
export const checkPendingContribution = async (
    walletAddress: string,
    provider: ProviderType
): Promise<ReclaimResult | null> => {
    try {
        console.log(`🔍 Checking pending contribution for ${walletAddress}/${provider}`);
        const response = await fetch(`${API_URL}/api/reclaim/pending/${walletAddress}/${provider}`);
        const data = await response.json();

        if (data.success && data.contribution) {
            console.log('✅ Found pending contribution:', data.contribution);
            return {
                proofId: data.contribution.proofId,
                data: data.contribution.data,
                dataType: data.contribution.dataType
            };
        }
        console.log('❌ No pending contribution found');
    } catch (e) {
        console.warn('Check pending failed:', e);
    }
    return null;
};

// Get pending verification from localStorage
export const getPendingVerification = (): PendingVerification | null => {
    try {
        const stored = localStorage.getItem(PENDING_KEY);
        if (stored) {
            const pending = JSON.parse(stored) as PendingVerification;
            // Check if not expired (10 minutes max)
            if (Date.now() - pending.startedAt < 10 * 60 * 1000) {
                return pending;
            }
            // Expired, clear it
            localStorage.removeItem(PENDING_KEY);
        }
    } catch (e) {
        console.warn('Error reading pending verification:', e);
    }
    return null;
};

// Clear pending verification
export const clearPendingVerification = () => {
    localStorage.removeItem(PENDING_KEY);
};

export const useReclaim = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address } = useWallet();

    // Check for pending verification on mount
    useEffect(() => {
        const pending = getPendingVerification();
        if (pending) {
            console.log('📋 Found pending verification in localStorage:', pending);
            setIsLoading(true);
        }
    }, []);

    // Start verification process (opens external URL)
    const startVerification = useCallback(async (provider: ProviderType): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const providerId = provider === 'zomato'
                ? ZOMATO_PROVIDER_ID
                : provider === 'github'
                    ? GITHUB_PROVIDER_ID
                    : NETFLIX_PROVIDER_ID;

            if (!RECLAIM_APP_ID || !RECLAIM_APP_SECRET || !providerId) {
                throw new Error('Reclaim not configured');
            }

            if (!address) {
                throw new Error('Wallet not connected');
            }

            const request = await ReclaimProofRequest.init(
                RECLAIM_APP_ID,
                RECLAIM_APP_SECRET,
                providerId
            );

            // Set callback URL to our backend webhook
            const callbackUrl = `${API_URL}/api/reclaim/callback`;
            request.setAppCallbackUrl(callbackUrl);

            // Add context so backend knows which user/provider this is for
            const contextData = JSON.stringify({
                walletAddress: address,
                provider,
                dataType: DATA_TYPE_MAP[provider]
            });
            request.addContext('sessionData', contextData);

            const url = await request.getRequestUrl();
            console.log('📋 Reclaim URL generated:', url);

            // Store pending verification in localStorage BEFORE navigating away
            const pending: PendingVerification = {
                provider,
                walletAddress: address,
                startedAt: Date.now()
            };
            localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            console.log('💾 Stored pending verification in localStorage');

            // Open Reclaim verification using Farcaster SDK
            // This will navigate away from the app
            sdk.actions.openUrl(url);

            return true;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(msg);
            setIsLoading(false);
            return false;
        }
    }, [address]);

    // Check if there's a completed verification waiting
    const checkForResult = useCallback(async (): Promise<ReclaimResult | null> => {
        const pending = getPendingVerification();
        if (!pending) {
            setIsLoading(false);
            return null;
        }

        console.log('🔍 Checking for verification result...');
        const result = await checkPendingContribution(pending.walletAddress, pending.provider);

        if (result) {
            // Clear pending since we got a result
            clearPendingVerification();
            setIsLoading(false);
            return result;
        }

        return null;
    }, []);

    const cancelVerification = useCallback(() => {
        clearPendingVerification();
        setIsLoading(false);
        setError(null);
    }, []);

    return {
        startVerification,
        checkForResult,
        cancelVerification,
        isLoading,
        error,
        hasPendingVerification: !!getPendingVerification(),
        getPendingVerification
    };
};
