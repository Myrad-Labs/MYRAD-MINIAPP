import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Award, Search, Check } from "lucide-react";

interface LeaderboardUser {
  id: string;
  username: string;
  walletAddress: string;
  totalPoints: number;
  league: string;
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin;

// 🔹 Detect connected wallet (replace later with your wallet hook if needed)
const MY_WALLET =
  (window as any)?.ethereum?.selectedAddress?.toLowerCase() || null;

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  /* -------------------------------- fetch -------------------------------- */
  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.leaderboard);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* --------------------------- rank + search ------------------------------ */
  const ranked = useMemo(() => {
    return data
      .slice()
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((u, idx) => ({
        ...u,
        rank: idx + 1
      }))
      .filter((u) =>
        u.walletAddress?.toLowerCase().includes(search.toLowerCase())
      );
  }, [data, search]);

  /* --------------------------- my rank logic ------------------------------ */
  const myEntry = useMemo(() => {
    if (!MY_WALLET) return null;
    return ranked.find(
      (u) => u.walletAddress?.toLowerCase() === MY_WALLET
    );
  }, [ranked]);

  /* ------------------------------ helpers -------------------------------- */
  const short = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyWallet = async (wallet: string) => {
    await navigator.clipboard.writeText(wallet);
    setCopied(wallet);
    setTimeout(() => setCopied(null), 1500);
  };

  /* -------------------------------- render -------------------------------- */
  if (loading) {
    return <p className="text-slate-500">Loading leaderboard…</p>;
  }
return (
  <div className="w-full max-w-xl mx-auto px-4 pb-24 space-y-5">

    {/* Header */}
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur py-4">
      <h1 className="text-2xl font-bold text-slate-900">Leaderboard</h1>
      <p className="text-xs text-slate-500">
        Ranked by total points earned
      </p>
    </div>

    {/* My Rank */}
    {myEntry && (
      <div className="rounded-xl bg-black text-white p-4 flex justify-between items-center">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-70">
            Your Rank
          </p>
          <p className="text-3xl font-extrabold">
            #{myEntry.rank}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xl font-bold">
            {myEntry.totalPoints.toLocaleString()}
          </p>
          <p className="text-xs opacity-70">Points</p>
        </div>
      </div>
    )}

    {/* Search */}
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search wallet…"
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-black"
      />
    </div>

    {/* Leaderboard List */}
    <div className="space-y-2">
      {ranked.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">
          No users found
        </p>
      )}

      {ranked.map((row) => {
        const isMe =
          MY_WALLET &&
          row.walletAddress.toLowerCase() === MY_WALLET;

        return (
          <div
            key={row.id}
            className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
              isMe
                ? "border-black bg-black/5"
                : "border-slate-200 bg-white"
            }`}
          >
            {/* Left */}
            <div className="flex items-center gap-3">
              <div className="w-7 text-center font-bold">
                {row.rank === 1 && <Trophy size={18} className="text-yellow-500" />}
                {row.rank === 2 && <Medal size={18} className="text-slate-400" />}
                {row.rank === 3 && <Award size={18} className="text-orange-400" />}
                {row.rank > 3 && row.rank}
              </div>

              <button
                onClick={() => copyWallet(row.walletAddress)}
                className="font-mono text-xs text-slate-700 flex items-center gap-1"
              >
                {copied === row.walletAddress ? (
                  <>
                    <Check size={12} className="text-green-600" />
                    Copied
                  </>
                ) : (
                  short(row.walletAddress)
                )}
              </button>
            </div>

            {/* Points */}
            <div className="text-right">
              <p className="font-semibold text-slate-900 text-sm">
                {row.totalPoints.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500">
                points
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

}
