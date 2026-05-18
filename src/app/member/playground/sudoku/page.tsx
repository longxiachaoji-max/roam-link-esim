"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Trophy, AlertCircle } from "lucide-react";
import Link from 'next/link';

// 預設一個中等難度的數獨題目
const INITIAL_BOARD = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

const SOLUTION_BOARD = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9]
];

export default function SudokuGame() {
  const [board, setBoard] = useState<number[][]>(INITIAL_BOARD.map(row => [...row]));
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [rewardMsg, setRewardMsg] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    };
    getUser();
  }, []);

  const handleCellClick = (r: number, c: number) => {
    // 只能選取原本是 0 (空格) 的格子
    if (INITIAL_BOARD[r][c] === 0 && !isWon) {
      setSelectedCell([r, c]);
    }
  };

  const handleNumberInput = (num: number) => {
    if (selectedCell && !isWon) {
      const [r, c] = selectedCell;
      const newBoard = [...board];
      newBoard[r] = [...newBoard[r]];
      newBoard[r][c] = num;
      setBoard(newBoard);
      checkWinCondition(newBoard);
    }
  };

  const checkWinCondition = (currentBoard: number[][]) => {
    let isCompleteAndCorrect = true;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] !== SOLUTION_BOARD[r][c]) {
          isCompleteAndCorrect = false;
          break;
        }
      }
    }
    if (isCompleteAndCorrect) {
      setIsWon(true);
      claimReward();
    }
  };

  const claimReward = async () => {
    if (!userEmail || isClaiming) return;
    setIsClaiming(true);
    try {
      const res = await fetch('/api/member/playground/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, game: 'Sudoku' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRewardMsg(`恭喜過關！獲得 ${data.reward} 元儲值金！`);
      } else {
        setRewardMsg('過關了！但領取獎勵失敗：' + data.error);
      }
    } catch (err: any) {
      setRewardMsg('過關了！但領取獎勵發生錯誤。');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans pb-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
        <Link href="/member" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <X size={20} className="text-white/70" />
        </Link>
        <span className="font-bold tracking-wider">旅行數獨挑戰</span>
        <div className="w-9"></div> {/* Spacer for center alignment */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        {isWon ? (
          <div className="bg-gradient-to-b from-yellow-500/20 to-transparent p-8 rounded-3xl border border-yellow-500/30 text-center mb-8 w-full animate-in zoom-in duration-500">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-yellow-400 mb-2">挑戰成功！</h2>
            <p className="text-white/80">{rewardMsg || '正在發放獎勵...'}</p>
            <Link href="/member" className="mt-6 inline-block bg-[#F05A28] text-white font-bold py-3 px-8 rounded-full hover:bg-[#d94f22] transition-colors">
              回會員中心
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-[#F05A28]">完成數獨獲得獎勵</h1>
              <p className="text-sm text-white/50 mt-1">填滿所有空格以獲得 免費儲值金</p>
            </div>

            {/* Sudoku Grid */}
            <div className="w-full aspect-square max-w-[360px] bg-white/5 border-2 border-white/20 rounded-xl p-1 mb-8">
              <div className="grid grid-cols-9 h-full w-full bg-black/50 rounded-lg overflow-hidden">
                {board.map((row, rIdx) => 
                  row.map((cell, cIdx) => {
                    const isInitial = INITIAL_BOARD[rIdx][cIdx] !== 0;
                    const isSelected = selectedCell?.[0] === rIdx && selectedCell?.[1] === cIdx;
                    
                    // Thicker borders for 3x3 subgrids
                    const borderRight = cIdx === 2 || cIdx === 5 ? 'border-r-2 border-r-white/30' : 'border-r border-r-white/10';
                    const borderBottom = rIdx === 2 || rIdx === 5 ? 'border-b-2 border-b-white/30' : 'border-b border-b-white/10';
                    
                    return (
                      <div 
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        className={`
                          flex items-center justify-center text-lg md:text-xl font-semibold
                          ${borderRight} ${borderBottom}
                          ${cIdx === 8 ? 'border-r-0' : ''}
                          ${rIdx === 8 ? 'border-b-0' : ''}
                          ${isInitial ? 'text-white/40 bg-white/5' : 'text-[#00D4FF] cursor-pointer hover:bg-white/10'}
                          ${isSelected ? 'bg-[#00D4FF]/20 shadow-[inset_0_0_10px_rgba(0,212,255,0.5)]' : ''}
                        `}
                      >
                        {cell !== 0 ? cell : ''}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Number Pad */}
            <div className="w-full max-w-[360px]">
              <div className="grid grid-cols-5 gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumberInput(num)}
                    className="bg-white/10 hover:bg-white/20 active:bg-[#00D4FF]/30 text-white font-bold py-4 rounded-xl text-xl transition-colors"
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumberInput(num)}
                    className="bg-white/10 hover:bg-white/20 active:bg-[#00D4FF]/30 text-white font-bold py-4 rounded-xl text-xl transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleNumberInput(0)}
                  className="bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 font-bold py-4 rounded-xl text-sm transition-colors flex items-center justify-center"
                >
                  清除
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => {
                // Cheat code for demo: Auto fill
                setBoard(SOLUTION_BOARD);
                checkWinCondition(SOLUTION_BOARD);
              }}
              className="mt-8 text-xs text-white/20 hover:text-white/50"
            >
              (測試用：一鍵過關)
            </button>
          </>
        )}
      </div>
    </div>
  );
}