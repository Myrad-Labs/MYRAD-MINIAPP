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
                        console.log('📦 Raw proofs (full):', proofs);

                        try {
                            // Handle both array and single proof
                            const proof = Array.isArray(proofs) ? proofs[0] : proofs;
                            let extractedData: Record<string, unknown> = {};
                            let proofId = `proof_${Date.now()}`;

                            if (typeof proof === 'object' && proof !== null) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const p = proof as any;

                                console.log('📋 Proof keys:', Object.keys(p));
                                proofId = p.identifier || proofId;

                                // 1. Try claimData.context (primary location)
                                if (p.claimData?.context) {
                                    console.log('📋 Raw claimData.context:', p.claimData.context);
                                    try {
                                        const ctx = typeof p.claimData.context === 'string'
                                            ? JSON.parse(p.claimData.context)
                                            : p.claimData.context;
                                        console.log('📋 Parsed context:', ctx);

                                        if (ctx.extractedParameters) {
                                            extractedData = { ...extractedData, ...ctx.extractedParameters };
                                            console.log('✅ Found extractedParameters:', ctx.extractedParameters);
                                        }

                                        // Some providers put data directly in context
                                        if (ctx.providerData) {
                                            extractedData = { ...extractedData, ...ctx.providerData };
                                        }
                                    } catch (e) {
                                        console.warn('Could not parse context:', e);
                                    }
                                }

                                // 2. Try claimData.parameters
                                if (p.claimData?.parameters) {
                                    console.log('📋 Raw parameters:', p.claimData.parameters);
                                    try {
                                        const params = typeof p.claimData.parameters === 'string'
                                            ? JSON.parse(p.claimData.parameters)
                                            : p.claimData.parameters;

                                        // Check for responseMatches
                                        if (params.responseMatches) {
                                            console.log('📋 Found responseMatches:', params.responseMatches);
                                        }
                                    } catch (e) {
                                        console.warn('Could not parse parameters:', e);
                                    }
                                }

                                // 3. Try extractedParameterValues (some SDK versions)
                                if (p.extractedParameterValues) {
                                    console.log('✅ Found extractedParameterValues:', p.extractedParameterValues);
                                    extractedData = { ...extractedData, ...p.extractedParameterValues };
                                }

                                // 4. Try publicData (some providers use this)
                                if (p.publicData) {
                                    console.log('✅ Found publicData:', p.publicData);
                                    extractedData = { ...extractedData, ...p.publicData };
                                }

                                // 5. Fallback: include raw claimData for debugging
                                if (Object.keys(extractedData).length === 0) {
                                    console.log('⚠️ No extracted data found, including raw claimData');
                                    extractedData = { rawClaimData: p.claimData };
                                }
                            }

                            console.log('📦 FINAL extracted data:', JSON.stringify(extractedData, null, 2));
                            setIsLoading(false);
                            resolve({ proofId, data: extractedData });
                        } catch (parseError) {
                            console.error('Error parsing proofs:', parseError);
                            setIsLoading(false);
                            resolve({ proofId: `proof_${Date.now()}`, data: { parseError: String(parseError) } });
                        }
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
