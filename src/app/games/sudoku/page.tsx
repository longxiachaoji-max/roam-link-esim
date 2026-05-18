"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Trophy } from "lucide-react";
import Link from "next/link";

// ─────────────────── Multiple Puzzles Per Difficulty ───────────────────

const EASY_PUZZLES = [
  {
    puzzle: [
      [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]
    ],
    solution: [
      [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
    ]
  },
  {
    puzzle: [
      [0,0,3,0,2,0,6,0,0],[9,0,0,3,0,5,0,0,1],[0,0,1,8,0,6,4,0,0],
      [0,0,8,1,0,2,9,0,0],[7,0,0,0,0,0,0,0,8],[0,0,6,7,0,8,2,0,0],
      [0,0,2,6,0,9,5,0,0],[8,0,0,2,0,3,0,0,9],[0,0,5,0,1,0,3,0,0]
    ],
    solution: [
      [4,8,3,9,2,1,6,5,7],[9,6,7,3,4,5,8,2,1],[2,5,1,8,7,6,4,9,3],
      [5,4,8,1,3,2,9,7,6],[7,2,9,5,6,4,1,3,8],[1,3,6,7,9,8,2,4,5],
      [3,7,2,6,8,9,5,1,4],[8,1,4,2,5,3,7,6,9],[6,9,5,4,1,7,3,8,2]
    ]
  }
];

const MEDIUM_PUZZLES = [
  {
    puzzle: [
      [0,0,0,2,6,0,7,0,1],[6,8,0,0,7,0,0,9,0],[1,9,0,0,0,4,5,0,0],
      [8,2,0,1,0,0,0,4,0],[0,0,4,6,0,2,9,0,0],[0,5,0,0,0,3,0,2,8],
      [0,0,9,3,0,0,0,7,4],[0,4,0,0,5,0,0,3,6],[7,0,3,0,1,8,0,0,0]
    ],
    solution: [
      [4,3,5,2,6,9,7,8,1],[6,8,2,5,7,1,4,9,3],[1,9,7,8,3,4,5,6,2],
      [8,2,6,1,9,5,3,4,7],[3,7,4,6,8,2,9,1,5],[9,5,1,7,4,3,6,2,8],
      [5,1,9,3,2,6,8,7,4],[2,4,8,9,5,7,1,3,6],[7,6,3,4,1,8,2,5,9]
    ]
  },
  {
    puzzle: [
      [0,0,0,6,0,0,4,0,0],[7,0,0,0,0,3,6,0,0],[0,0,0,0,9,1,0,8,0],
      [0,0,0,0,0,0,0,0,0],[0,5,0,1,8,0,0,0,3],[0,0,0,3,0,6,0,4,5],
      [0,4,0,2,0,0,0,6,0],[9,0,3,0,0,0,0,0,0],[0,2,0,0,0,0,1,0,0]
    ],
    solution: [
      [5,8,1,6,7,2,4,3,9],[7,9,2,8,4,3,6,5,1],[3,6,4,5,9,1,7,8,2],
      [4,3,8,9,5,7,2,1,6],[2,5,6,1,8,4,9,7,3],[1,7,9,3,2,6,8,4,5],
      [8,4,5,2,1,9,3,6,7],[9,1,3,7,6,8,5,2,4],[6,2,7,4,3,5,1,9,8]
    ]
  }
];

const HARD_PUZZLES = [
  {
    puzzle: [
      [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],
      [0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],
      [5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9]
    ],
    solution: [
      [9,8,7,6,5,4,3,2,1],[2,4,6,1,7,3,9,8,5],[3,5,1,9,2,8,7,4,6],
      [1,2,8,5,3,7,6,9,4],[6,3,4,8,9,2,1,5,7],[7,9,5,4,6,1,8,3,2],
      [5,1,9,2,8,6,4,7,3],[4,7,2,3,1,9,5,6,8],[8,6,3,7,4,5,2,1,9]
    ]
  },
  {
    puzzle: [
      [0,2,0,0,0,0,0,0,0],[0,0,0,6,0,0,0,0,3],[0,7,4,0,8,0,0,0,0],
      [0,0,0,0,0,3,0,0,2],[0,8,0,0,4,0,0,1,0],[6,0,0,5,0,0,0,0,0],
      [0,0,0,0,1,0,7,8,0],[5,0,0,0,0,9,0,0,0],[0,0,0,0,0,0,0,4,0]
    ],
    solution: [
      [1,2,6,4,3,7,9,5,8],[8,9,5,6,2,1,4,7,3],[3,7,4,9,8,5,1,2,6],
      [4,5,7,1,9,3,8,6,2],[9,8,3,2,4,6,5,1,7],[6,1,2,5,7,8,3,9,4],
      [2,6,9,3,1,4,7,8,5],[5,4,8,7,6,9,2,3,1],[7,3,1,8,5,2,6,4,9]
    ]
  }
];

type Difficulty = "easy" | "medium" | "hard";

function getRandomPuzzle(diff: Difficulty) {
  const list = diff === "easy" ? EASY_PUZZLES : diff === "medium" ? MEDIUM_PUZZLES : HARD_PUZZLES;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

const MAX_CHANCES = 3;

export default function SudokuGame() {
  const [screen, setScreen] = useState<"select" | "game" | "won" | "lost">("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [puzzle, setPuzzle] = useState<number[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [board, setBoard] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [chances, setChances] = useState(MAX_CHANCES);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [rewardMsg, setRewardMsg] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setUserEmail(session.user.email);
    };
    getUser();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const startGame = (diff: Difficulty) => {
    const p = getRandomPuzzle(diff);
    setDifficulty(diff);
    setPuzzle(p.puzzle.map(r => [...r]));
    setSolution(p.solution.map(r => [...r]));
    setBoard(p.puzzle.map(r => [...r]));
    setSelectedCell(null);
    setChances(MAX_CHANCES);
    setRewardMsg("");
    setScreen("game");
  };

  const resetGame = () => {
    const p = getRandomPuzzle(difficulty);
    setPuzzle(p.puzzle.map(r => [...r]));
    setSolution(p.solution.map(r => [...r]));
    setBoard(p.puzzle.map(r => [...r]));
    setSelectedCell(null);
    setChances(MAX_CHANCES);
    setRewardMsg("");
    setScreen("game");
  };

  const handleCellClick = (r: number, c: number) => {
    if (puzzle[r]?.[c] === 0 && screen === "game") setSelectedCell([r, c]);
  };

  const handleNumberInput = (num: number) => {
    if (!selectedCell || screen !== "game") return;
    const [r, c] = selectedCell;
    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;
    setBoard(newBoard);
  };

  const handleSubmit = async () => {
    // 不限制要填滿，直接比對有填的格子
    let allCorrect = true;
    const newBoard = board.map(row => [...row]);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        // 只檢查用戶填的格子 (原本是空的)
        if (puzzle[r][c] === 0 && board[r][c] !== 0) {
          if (board[r][c] !== solution[r][c]) {
            allCorrect = false;
            newBoard[r][c] = 0; // 清除錯誤的
          }
        } else if (puzzle[r][c] === 0 && board[r][c] === 0) {
          // 還沒填的格子也算未完成
          allCorrect = false;
        }
      }
    }

    // 更新棋盤 (清除錯誤)
    setBoard(newBoard);

    if (allCorrect) {
      setScreen("won");
      if (difficulty === "hard") await claimReward();
      else setRewardMsg("恭喜過關！🎉");
      return;
    }

    const remaining = chances - 1;
    setChances(remaining);
    setSelectedCell(null);

    if (remaining <= 0) {
      setScreen("lost");
    } else {
      showToast(`答案有誤，已清除錯誤格子，剩餘 ${remaining} 次機會`);
    }
  };

  const claimReward = async () => {
    if (!userEmail || isClaiming) return;
    setIsClaiming(true);
    try {
      const res = await fetch("/api/member/playground/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, game: "Sudoku", difficulty: "hard" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRewardMsg(data.reward > 0
          ? `恭喜過關！🏆 成功獲得 ${data.reward} 點儲值金！`
          : "恭喜過關！🎉 今日已領取過獎勵，明日再來！"
        );
      } else {
        setRewardMsg("過關了！但領取獎勵失敗，請稍後再試。");
      }
    } catch {
      setRewardMsg("過關了！但發生錯誤。");
    } finally {
      setIsClaiming(false);
    }
  };

  const diffLabel = difficulty === "easy" ? "簡單" : difficulty === "medium" ? "普通" : "困難";
  const diffColor = difficulty === "easy"
    ? "text-green-400 bg-green-400/10 border-green-400/30"
    : difficulty === "medium"
    ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
    : "text-red-400 bg-red-400/10 border-red-400/30";

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans pb-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
        <Link href="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <X size={20} className="text-white/70" />
        </Link>
        <span className="font-bold tracking-wider">數獨挑戰 🔢</span>
        {screen === "game" ? (
          <div className={`text-xs font-bold px-3 py-1 rounded-full border ${diffColor}`}>{diffLabel}</div>
        ) : (
          <Link href="/games" className="text-xs text-white/40 hover:text-white/60 border border-white/10 px-3 py-1 rounded-full transition-colors">大廳</Link>
        )}
      </div>

      {/* Difficulty Select */}
      {screen === "select" && (
        <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full">
          <div className="mt-8 mb-8">
            <h1 className="text-2xl font-black text-[#F05A28] mb-1">選擇難度</h1>
            <p className="text-white/50 text-sm">每次進入都是隨機題目！</p>
          </div>
          <div className="space-y-4">
            {[
              { key: "easy" as Difficulty, label: "簡單", color: "text-green-400 border-green-400/40 bg-green-400/10 hover:bg-green-400/20" },
              { key: "medium" as Difficulty, label: "普通", color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/20" },
              { key: "hard" as Difficulty, label: "困難", color: "text-red-400 border-red-400/40 bg-red-400/10 hover:bg-red-400/20" },
            ].map(opt => (
              <button key={opt.key} onClick={() => startGame(opt.key)}
                className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${opt.color}`}>
                <div className="text-left">
                  <div className="font-bold text-lg">{opt.label}</div>
                  {opt.key === "hard" && (
                    <div className="text-xs text-yellow-400 mt-1">🪙 每日可獲得 1 點儲值金</div>
                  )}
                </div>
                <span className="text-xl">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Game */}
      {screen === "game" && (
        <div className="flex-1 flex flex-col items-center p-4 max-w-md mx-auto w-full">
          <div className="w-full flex items-center justify-between mb-4 mt-2">
            <div className="text-sm text-white/60">🎯 剩餘機會：<span className="font-bold text-white">{chances}</span> 次</div>
            <button onClick={() => setScreen("select")} className="text-xs text-white/40 hover:text-white/60 border border-white/10 px-3 py-1 rounded-full transition-colors">換難度</button>
          </div>

          <div className="w-full aspect-square max-w-[360px] bg-white/5 border-2 border-white/20 rounded-xl p-1 mb-6">
            <div className="grid grid-cols-9 h-full w-full bg-black/50 rounded-lg overflow-hidden">
              {board.map((row, rIdx) => row.map((cell, cIdx) => {
                const isInitial = puzzle[rIdx]?.[cIdx] !== 0;
                const isSelected = selectedCell?.[0] === rIdx && selectedCell?.[1] === cIdx;
                const borderRight = cIdx === 2 || cIdx === 5 ? "border-r-2 border-r-white/30" : "border-r border-r-white/10";
                const borderBottom = rIdx === 2 || rIdx === 5 ? "border-b-2 border-b-white/30" : "border-b border-b-white/10";
                return (
                  <div key={`${rIdx}-${cIdx}`} onClick={() => handleCellClick(rIdx, cIdx)}
                    className={`flex items-center justify-center text-base md:text-lg font-semibold ${borderRight} ${borderBottom} ${cIdx === 8 ? "border-r-0" : ""} ${rIdx === 8 ? "border-b-0" : ""} ${isInitial ? "text-white/50 bg-white/5" : "text-[#00D4FF] cursor-pointer hover:bg-white/10"} ${isSelected ? "bg-[#00D4FF]/20 shadow-[inset_0_0_10px_rgba(0,212,255,0.5)]" : ""}`}>
                    {cell !== 0 ? cell : ""}
                  </div>
                );
              }))}
            </div>
          </div>

          <div className="w-full max-w-[360px] mb-5">
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => handleNumberInput(n)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl text-xl transition-colors">{n}</button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[6,7,8,9].map(n => (
                <button key={n} onClick={() => handleNumberInput(n)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl text-xl transition-colors">{n}</button>
              ))}
              <button onClick={() => handleNumberInput(0)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3.5 rounded-xl text-sm transition-colors">清除</button>
            </div>
          </div>

          <button onClick={handleSubmit}
            className="w-full max-w-[360px] bg-[#F05A28] hover:bg-[#d94f22] shadow-[0_0_20px_rgba(240,90,40,0.4)] text-white font-black py-4 rounded-2xl text-lg transition-all hover:-translate-y-0.5">
            送出答案 ✓
          </button>
        </div>
      )}

      {/* Won */}
      {screen === "won" && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
          <div className="bg-gradient-to-b from-yellow-500/20 to-transparent p-8 rounded-3xl border border-yellow-500/30 text-center w-full">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-3xl font-black text-yellow-400 mb-3">挑戰成功！</h2>
            <p className="text-white/80 mb-6">
              {difficulty === "hard"
                ? (rewardMsg || (isClaiming ? "正在發放獎勵..." : ""))
                : `太厲害了！完成 ${diffLabel} 難度！🎉`}
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={resetGame} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl">再玩一次</button>
              <Link href="/games" className="block w-full bg-[#F05A28] hover:bg-[#d94f22] text-white font-bold py-3 rounded-2xl text-center">回遊戲大廳</Link>
            </div>
          </div>
        </div>
      )}

      {/* Lost */}
      {screen === "lost" && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
          <div className="bg-gradient-to-b from-red-500/20 to-transparent p-8 rounded-3xl border border-red-500/30 text-center w-full">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-3xl font-black text-red-400 mb-3">挑戰失敗</h2>
            <p className="text-white/60 mb-6">機會用完了！再接再厲！</p>
            <div className="flex flex-col gap-3">
              <button onClick={resetGame} className="w-full bg-[#F05A28] hover:bg-[#d94f22] text-white font-bold py-3.5 rounded-2xl">重新挑戰</button>
              <Link href="/games" className="block w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl text-center">回遊戲大廳</Link>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-5 py-3 rounded-full font-bold shadow-2xl z-[100] text-sm whitespace-nowrap max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
