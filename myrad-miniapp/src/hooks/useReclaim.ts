// src/hooks/useReclaim.ts
// Hook for Reclaim Protocol verification

import { useState, useCallback } from 'react';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';

const RECLAIM_APP_ID = import.meta.env.VITE_RECLAIM_APP_ID;
const RECLAIM_APP_SECRET = import.meta.env.VITE_RECLAIM_APP_SECRET;
const ZOMATO_PROVIDER_ID = import.meta.env.VITE_ZOMATO_PROVIDER_ID;
const GITHUB_PROVIDER_ID = import.meta.env.VITE_GITHUB_PROVIDER_ID;

export type ProviderType = 'zomato' | 'github';

export interface ReclaimResult {
    proofId: string;
    data: Record<string, unknown>;
}

export const useReclaim = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const verify = useCallback(async (provider: ProviderType): Promise<ReclaimResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const providerId = provider === 'zomato' ? ZOMATO_PROVIDER_ID : GITHUB_PROVIDER_ID;

            if (!RECLAIM_APP_ID || !RECLAIM_APP_SECRET || !providerId) {
                throw new Error('Reclaim not configured');
            }

            const request = await ReclaimProofRequest.init(
                RECLAIM_APP_ID,
                RECLAIM_APP_SECRET,
                providerId
            );

            const url = await request.getRequestUrl();
            window.open(url, '_blank');

            return new Promise((resolve, reject) => {
                request.startSession({
                    onSuccess: (proofs) => {
                        console.log('✅ Reclaim verification successful');
                        console.log('📦 Raw proofs:', JSON.stringify(proofs, null, 2));

                        const proof = Array.isArray(proofs) ? proofs[0] : proofs;
                        let extractedData: Record<string, unknown> = {};
                        let proofId = `proof_${Date.now()}`;

                        if (typeof proof === 'object' && proof !== null) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const p = proof as any;
                            proofId = p.identifier || proofId;

                            // Try to extract data from claimData.context
                            try {
                                if (p.claimData?.context) {
                                    const ctx = JSON.parse(p.claimData.context);
                                    console.log('📋 Parsed context:', JSON.stringify(ctx, null, 2));
                                    extractedData = ctx.extractedParameters || {};
                                }
                            } catch (e) {
                                console.warn('Could not parse proof context:', e);
                            }

                            // Also try to get data from claimData.parameters
                            if (p.claimData?.parameters) {
                                try {
                                    const params = typeof p.claimData.parameters === 'string'
                                        ? JSON.parse(p.claimData.parameters)
                                        : p.claimData.parameters;
                                    extractedData = { ...extractedData, ...params };
                                    console.log('📋 Extracted parameters:', params);
                                } catch (e) {
                                    console.warn('Could not parse parameters:', e);
                                }
                            }

                            // Fallback: include any claimData fields directly
                            if (Object.keys(extractedData).length === 0 && p.claimData) {
                                extractedData = {
                                    ...extractedData,
                                    rawClaimData: p.claimData
                                };
                                console.log('📋 Using raw claimData as fallback');
                            }
                        }

                        console.log('📦 Final extracted data:', JSON.stringify(extractedData, null, 2));
                        setIsLoading(false);
                        resolve({ proofId, data: extractedData });
                    },
                    onError: (err) => {
                        console.error('❌ Reclaim verification error:', err);
                        setError(err?.message || 'Verification failed');
                        setIsLoading(false);
                        reject(err);
                    },
                });
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Verification failed';
            setError(msg);
            setIsLoading(false);
            return null;
        }
    }, []);

    return { verify, isLoading, error };
};
