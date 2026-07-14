"use client";

import { Battle, RoundResult, getTopicConfig, toBOGX } from "./types";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { compareBattleResults } from "@/utils/battleWinner";

interface BattleResultScreenProps {
  battle: Battle;
  myResults: RoundResult[];
  opponentResults: RoundResult[];
  myTotalPoints: number;
  opponentTotalPoints: number;
  isCreator: boolean;
  userAvatar?: string;
  onBackToPool: () => void;
  onRematch: () => void;
  onContinue: () => void;
}

export default function BattleResultScreen({
  battle,
  myResults,
  opponentResults,
  myTotalPoints,
  opponentTotalPoints,
  isCreator,
  userAvatar,
  onBackToPool,
  onRematch,
  onContinue,
}: BattleResultScreenProps) {
  const topic = getTopicConfig(battle.topic);
  const isComplete = myResults.length >= battle.rounds;
  
  // Winner = most correct answers; tie-break by fastest total time.
  const cmp = compareBattleResults(myResults, opponentResults);
  const won = cmp > 0;
  const leading = cmp >= 0;
  const myCorrect = myResults.filter(r => r.correct).length;
  const oppCorrect = opponentResults.filter(r => r.correct).length;
  
  // Shown so it's transparent WHY a winner was picked when points look tied
  const myTotalTime = myResults.reduce((sum, r: any) => sum + (r.timeMs || 0), 0);
  const oppTotalTime = opponentResults.reduce((sum, r: any) => sum + (r.timeMs || 0), 0);

  return (
    <div className="flex flex-col h-full p-4 bg-cream">
      {/* Card Container */}
      <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 overflow-y-auto shadow-sm">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
            <topic.icon className="w-3 h-3 inline" /> {topic.label}
          </span>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            {isComplete ? 'Battle Complete' : `After Round ${myResults.length}`}
          </span>
        </div>

        {/* Result/Status */}
        <div className="text-center mb-6">
          {isComplete ? (
            <>
              <div 
                className="font-display text-4xl tracking-wider mb-1"
                style={{ color: won ? '#22c55e' : '#ef4444' }}
              >
                {won ? 'YOU WIN!' : 'YOU LOSE'}
              </div>
              <div 
                className="font-display text-lg tracking-wider flex items-center justify-center gap-1"
                style={{ color: won ? '#22c55e' : '#ef4444' }}
              >
                {won ? '+' : '-'}{formatCurrency(toBOGX(battle.wager))} <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-4xl tracking-wider mb-1 text-gray-900">
                ROUND {myResults.length} DONE!
              </div>
              <div className="text-sm text-gray-500">
                Your score: {formatCurrency(myTotalPoints)} {getCurrencySymbol()}
              </div>
            </>
          )}
        </div>

        {/* Players - Only show full details when battle is complete */}
        {isComplete ? (
          <div className="border border-warm rounded-xl bg-cream mb-4">
            <div className="flex items-center gap-3 p-3 border-b border-warm">
              <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${leading ? 'border-[#A855F7]' : 'border-warm'}`}>
                <img src={userAvatar} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{won ? '👑 ' : ''}You</div>
                <div className="text-[10px] text-gray-400">{formatCurrency(myTotalPoints)} BOGX</div>
              </div>
              <div className="text-right">
                <div className={`font-display text-2xl leading-none ${leading ? 'text-green-600' : 'text-gray-400'}`}>
                  {myCorrect}<span className="text-sm text-gray-400">/{myResults.length}</span>
                </div>
                <div className="text-[8px] uppercase tracking-widest text-gray-400 font-semibold">Correct</div>
                <div className="text-[10px] text-gray-400 mt-0.5">⏱ {(myTotalTime / 1000).toFixed(1)}s</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3">
              {isCreator ? (
                <>
                  <div className="w-8 h-8 rounded-full border-2 border-warm bg-cream flex items-center justify-center">
                    <span className="text-gray-600 font-bold">?</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-600">Waiting for opponent...</div>
                    <div className="text-[10px] text-gray-300">? BOGX</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl leading-none text-gray-300">?<span className="text-sm">/?</span></div>
                    <div className="text-[8px] uppercase tracking-widest text-gray-300 font-semibold">Correct</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${!leading ? 'border-[#A855F7]' : 'border-warm'}`}>
                    <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{!won ? '👑 ' : ''}{battle.creator.username}</div>
                    <div className="text-[10px] text-gray-400">{formatCurrency(opponentTotalPoints)} BOGX</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-2xl leading-none ${!leading ? 'text-green-600' : 'text-gray-400'}`}>
                      {oppCorrect}<span className="text-sm text-gray-400">/{opponentResults.length}</span>
                    </div>
                    <div className="text-[8px] uppercase tracking-widest text-gray-400 font-semibold">Correct</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">⏱ {(oppTotalTime / 1000).toFixed(1)}s</div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          // During game - only show own progress
          <div className="border border-warm rounded-xl bg-cream mb-4 p-4 text-center">
            <div className="text-gray-500 text-sm mb-2">Your Progress</div>
            <div className="font-display text-3xl text-gray-900 mb-1">{formatCurrency(myTotalPoints)} {getCurrencySymbol()}</div>
            <div className="text-gray-600 text-xs">{myCorrect}/{myResults.length} correct</div>
          </div>
        )}

        {/* Round by Round Scoreboard - Only show when battle is complete */}
        {isComplete && (
          <div className="mb-4">
            <div className="text-[9px] font-semibold tracking-widest text-gray-600 uppercase mb-2">
              Round by Round
            </div>
            <table className="w-full border border-warm bg-cream rounded-lg text-sm overflow-hidden">
              <thead>
                <tr className="bg-cream">
                  <th className="p-2 text-left text-[9px] font-semibold tracking-wider text-gray-600"></th>
                  {Array.from({ length: battle.rounds }).map((_, i) => (
                    <th key={i} className={`p-2 text-center text-[9px] font-semibold tracking-wider ${i < myResults.length ? 'text-gray-500' : 'text-gray-300'}`}>
                      R{i + 1}
                    </th>
                  ))}
                  <th className="p-2 text-center text-[9px] font-semibold tracking-wider text-gray-600 border-l border-warm">
                    TOT
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-warm">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <img src={userAvatar} alt="" className="w-5 h-5 rounded-full" />
                      <span className="text-xs font-semibold text-gray-900">You</span>
                    </div>
                  </td>
                  {Array.from({ length: battle.rounds }).map((_, i) => {
                    const r = myResults[i];
                    return (
                      <td key={i} className={`p-2 text-center ${r ? (r.correct ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                        {r ? (r.correct ? formatCurrency(r.points) : '—') : '·'}
                      </td>
                    );
                  })}
                  <td className={`p-2 text-center font-display text-lg border-l border-warm ${leading ? 'text-green-600' : 'text-gray-600'}`}>
                    {formatCurrency(myTotalPoints)}
                  </td>
                </tr>
                <tr className="border-t border-warm">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {isCreator ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-cream flex items-center justify-center">
                            <span className="text-gray-600 text-[10px] font-bold">?</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-600">???</span>
                        </>
                      ) : (
                        <>
                          <img src={battle.creator.avatar} alt="" className="w-5 h-5 rounded-full" />
                          <span className="text-xs font-semibold text-gray-900">{battle.creator.username}</span>
                        </>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: battle.rounds }).map((_, i) => {
                    if (isCreator) {
                      return <td key={i} className="p-2 text-center text-gray-300">?</td>;
                    }
                    const r = opponentResults[i];
                    return (
                      <td key={i} className={`p-2 text-center ${r ? (r.correct ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                        {r ? (r.correct ? formatCurrency(r.points) : '—') : '·'}
                      </td>
                    );
                  })}
                  <td className={`p-2 text-center font-display text-lg border-l border-warm ${isCreator ? 'text-gray-300' : (!leading ? 'text-green-600' : 'text-gray-600')}`}>
                    {isCreator ? '?' : formatCurrency(opponentTotalPoints)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Buttons - different for inter vs final */}
        {isComplete ? (
          <div className="flex gap-2">
            <button
              onClick={onBackToPool}
              className="flex-1 py-3 bg-cream border border-warm text-gray-600 font-display text-sm tracking-widest rounded-xl"
            >
              ← POOL
            </button>
            <button
              onClick={onRematch}
              className="flex-1 py-3 bg-[#A855F7] text-white font-display text-sm tracking-widest rounded-xl"
            >
              REMATCH ⚔
            </button>
          </div>
        ) : (
          <button
            onClick={onContinue}
            className="w-full py-4 bg-[#A855F7] text-white font-display tracking-widest rounded-xl"
          >
            ROUND {myResults.length + 1} →
          </button>
        )}
      </div>
    </div>
  );
}
