"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { X } from "lucide-react";

interface GameCard {
  id: string;
  emoji: string;
  name: string;
  description: string;
  hasHardReward: boolean;
  href: string;
}

const GAMES: GameCard[] = [
  {
    id: "sudoku",
    emoji: "🔢",
    name: "數獨挑戰",
    description: "考驗邏輯推理，填滿數字方格。",
    hasHardReward: true,
    href: "/games/sudoku",
  },
];

export default function GamesLobby() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: customer } = await supabase
          .from("customers")
          .select("*")
          .eq("email", session.user.email)
          .single();
        setUser(customer || session.user);
      } else {
        window.location.href = "/";
        return;
      }
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">
        載入中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button
          onClick={() => window.history.back()}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={20} className="text-white/70" />
        </button>
        <span className="font-bold tracking-wider">旅遊玩伴</span>
        <div className="w-9" />
      </div>

      <div className="p-4 md:max-w-md md:mx-auto">
        {/* Title */}
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-black text-[#F05A28] mb-1">🎮 旅遊玩伴</h1>
          <p className="text-white/50 text-sm">玩小遊戲，贏取免費儲值金！</p>
        </div>

        {/* Game Cards */}
        <div className="space-y-4">
          {GAMES.map((game) => (
            <div
              key={game.id}
              className="bg-[#1a1a24] border border-white/5 rounded-3xl p-6 shadow-lg"
            >
              {/* Emoji icon */}
              <div className="text-5xl mb-4">{game.emoji}</div>

              {/* Name & description */}
              <div className="mb-2">
                <h2 className="text-xl font-bold text-white mb-1">{game.name}</h2>
                <p className="text-sm text-white/50">{game.description}</p>
              </div>

              {/* Hard reward badge */}
              {game.hasHardReward && (
                <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full mb-5">
                  🪙 困難模式每日可獲得 1 點儲值金
                </div>
              )}

              {/* Enter button */}
              <div>
                <Link
                  href={game.href}
                  className="block w-full bg-[#F05A28] hover:bg-[#d94f22] text-white font-bold py-3.5 rounded-2xl text-center transition-all"
                >
                  進入遊戲 ▶
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
