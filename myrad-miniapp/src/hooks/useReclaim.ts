// src/hooks/useReclaim.ts
// Hook for Reclaim Protocol verification with callback URL approach for mini-apps

import { useState, useCallback, useEffect, useRef } from 'react';
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

export interface PendingVerification {
    provider: ProviderType;
    startedAt: number;
}

// Check for pending contribution from backend
export const checkPendingContribution = async (
    walletAddress: string,
    provider: ProviderType
): Promise<ReclaimResult | null> => {
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
        console.warn('Check pending failed:', e);
    }
    return null;
};

export const useReclaim = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
    const { address } = useWallet();
    const callbackRef = useRef<((result: ReclaimResult | null) => void) | null>(null);

    // Listen for visibility changes to check for completed verifications
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && pendingVerification && address) {
                console.log('📱 App became visible, checking for pending contribution...');

                // Small delay to ensure backend has processed
                await new Promise(resolve => setTimeout(resolve, 1000));

                const result = await checkPendingContribution(address, pendingVerification.provider);

                if (result && callbackRef.current) {
                    console.log('✅ Found result after visibility change');
                    callbackRef.current(result);
                    setPendingVerification(null);
                    callbackRef.current = null;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Also check periodically while visible (for cases where visibility event isn't fired)
        const interval = setInterval(async () => {
            if (document.visibilityState === 'visible' && pendingVerification && address) {
                const result = await checkPendingContribution(address, pendingVerification.provider);
                if (result && callbackRef.current) {
                    console.log('✅ Found result during polling');
                    callbackRef.current(result);
                    setPendingVerification(null);
                    callbackRef.current = null;
                    setIsLoading(false);
                }
            }
        }, 3000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, [pendingVerification, address]);

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

            // Store pending verification state
            setPendingVerification({ provider, startedAt: Date.now() });

            // Return a promise that will be resolved when visibility changes detect the result
            return new Promise((resolve) => {
                callbackRef.current = (result) => {
                    setIsLoading(false);
                    resolve(result);
                };

                // Open Reclaim verification using Farcaster SDK
                // This will navigate away from the app
                sdk.actions.openUrl(url);

                // Set a timeout to resolve with null if no result after 3 minutes
                setTimeout(() => {
                    if (callbackRef.current) {
                        console.log('⏰ Verification timed out');
                        setError('Verification timed out. Please try again.');
                        setIsLoading(false);
                        setPendingVerification(null);
                        callbackRef.current = null;
                        resolve(null);
                    }
                }, 180000); // 3 minutes
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(msg);
            setIsLoading(false);
            return null;
        }
    }, [address]);

    const cancelVerification = useCallback(() => {
        setPendingVerification(null);
        callbackRef.current = null;
        setIsLoading(false);
        setError(null);
    }, []);

    return {
        verify,
        isLoading,
        error,
        pendingVerification,
        cancelVerification,
        checkPendingContribution: address
            ? (provider: ProviderType) => checkPendingContribution(address, provider)
            : null
    };
};
