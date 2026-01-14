// src/hooks/useReclaim.ts
// Hook for Reclaim Protocol verification with callback URL approach for mini-apps

import { useState, useCallback } from 'react';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
import sdk from '@farcaster/miniapp-sdk';
import { useWallet } from './useWallet';

const RECLAIM_APP_ID = import.meta.env.VITE_RECLAIM_APP_ID;
const RECLAIM_APP_SECRET = import.meta.env.VITE_RECLAIM_APP_SECRET;
const ZOMATO_PROVIDER_ID = import.meta.env.VITE_ZOMATO_PROVIDER_ID;
const GITHUB_PROVIDER_ID = import.meta.env.VITE_GITHUB_PROVIDER_ID;
const NETFLIX_PROVIDER_ID = import.meta.env.VITE_NETFLIX_PROVIDER_ID;
const API_URL = import.meta.env.VITE_API_URL || '';

export type ProviderType = 'zomato' | 'github' | 'netflix';

const DATA_TYPE_MAP: Record<ProviderType, string> = {
    zomato: 'zomato_order_history',
    github: 'github_profile',
    netflix: 'netflix_watch_history'
};

export interface ReclaimResult {
    proofId: string;
    data: Record<string, unknown>;
}

export const useReclaim = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address } = useWallet();

    // Poll backend for pending contribution after user returns from Reclaim
    const pollForPendingContribution = useCallback(async (
        walletAddress: string,
        provider: ProviderType,
        maxAttempts = 30,
        intervalMs = 2000
    ): Promise<ReclaimResult | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(`${API_URL}/api/reclaim/pending/${walletAddress}/${provider}`);
                const data = await response.json();

                if (data.success && data.contribution) {
                    console.log('✅ Found pending contribution:', data.contribution);
                    return {
                        proofId: data.contribution.proofId,
                        data: data.contribution.data
                    };
                }
            } catch (e) {
                console.warn('Poll attempt failed:', e);
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        return null;
    }, []);

    const verify = useCallback(async (provider: ProviderType): Promise<ReclaimResult | null> => {
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
            console.log('📋 Callback URL:', callbackUrl);

            // Open Reclaim verification using Farcaster SDK
            sdk.actions.openUrl(url);

            // Poll for the proof to arrive at our backend
            console.log('⏳ Waiting for Reclaim callback...');
            const result = await pollForPendingContribution(address, provider);

            if (result) {
                setIsLoading(false);
                return result;
            } else {
                throw new Error('Verification timed out. Please try again.');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(msg);
            setIsLoading(false);
            return null;
        }
    }, [address, pollForPendingContribution]);

    return { verify, isLoading, error };
};
