// src/services/api.ts
// Simple API service for MYRAD backend

// Use relative URL - Vite proxies /api to backend
const API_URL = '';

// Generate auth token from wallet address
export const generateAuthToken = (walletAddress: string): string => {
    return `privy_${walletAddress}_user`;
};

// Submit data contribution to backend
export const submitContribution = async (
    walletAddress: string,
    data: {
        anonymizedData: Record<string, unknown>;
        dataType: 'zomato_order_history' | 'github_profile';
        reclaimProofId?: string;
    }
): Promise<{
    success: boolean;
    contribution: {
        id: string;
        pointsAwarded: number;
    };
    message: string;
}> => {
    const token = generateAuthToken(walletAddress);

    // First verify/create user
    await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    // Then submit contribution
    const response = await fetch(`${API_URL}/api/contribute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            anonymizedData: {
                ...data.anonymizedData,
                walletAddress,
            },
            dataType: data.dataType,
            reclaimProofId: data.reclaimProofId,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Contribution failed');
    }

    return response.json();
};

// Get user points
export const getUserPoints = async (walletAddress: string): Promise<number> => {
    const token = generateAuthToken(walletAddress);

    try {
        const response = await fetch(`${API_URL}/api/user/points`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            return data.points?.balance || 0;
        }
    } catch {
        // User might not exist yet
    }

    return 0;
};
