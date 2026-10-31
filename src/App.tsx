/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Lightbulb,
  CheckCircle2,
  Eye,
  Volume2,
  VolumeX,
  Bookmark,
  RotateCcw,
  ArrowRight,
  KeyRound,
  Sparkles,
  ExternalLink,
  Trophy,
  Compass,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { INDIVIDUAL_PUZZLES, WORKSHEET_GRIDS, RebusChallenge } from './data/rebusData';
import { checkAnswerMatch, buildWordSlotGroups } from './utils/matcher';
import { soundEngine } from './utils/sound';
import { RebusVisualStage } from './components/RebusVisualStage';
import { ArchiveBrowserView } from './components/ArchiveBrowserView';
import { WorksheetSolverView } from './components/WorksheetSolverView';

type ActiveTab = 'PLAY_DECK' | 'ARCHIVE' | 'WORKSHEETS' | 'RULES_STATS' | 'SPRINT_SUMMARY';

interface HintStateForPuzzle {
  tier1Unlocked: boolean; // Structure (free)
  tier2Unlocked: boolean; // Official Clue (-15 pts)
  tier3Unlocked: boolean; // First Letters locked into slots (-25 pts)
  revealedLetterIndices: number[]; // Specific global letter indices revealed (-10 pts each)
}

interface SprintRunResult {
  puzzle: RebusChallenge;
  outcome: 'solved' | 'revealed' | 'skipped';
  pointsEarned: number;
  hintsUsed: number;
}

const STORAGE_KEY = 'pad_rebus_save_v1';
const THEME_STORAGE_KEY = 'pad_rebus_theme_v1';

export default function App() {
  // Dark Mode State (persisted & synced to <html>)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Navigation & Game Mode state
  const [activeTab, setActiveTab] = useState<ActiveTab>('PLAY_DECK');
  const [deckCategory, setDeckCategory] = useState<string>('All');
  const [unsolvedOnly, setUnsolvedOnly] = useState<boolean>(false);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string>(INDIVIDUAL_PUZZLES[0]?.id || '');

  // Persistent Player Progress
  const [score, setScore] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return typeof saved.score === 'number' ? saved.score : 0;
    } catch {
      return 0;
    }
  });
  const [streak, setStreak] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return typeof saved.streak === 'number' ? saved.streak : 0;
    } catch {
      return 0;
    }
  });
  const [bestStreak, setBestStreak] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return typeof saved.bestStreak === 'number' ? saved.bestStreak : 0;
    } catch {
      return 0;
    }
  });
  const [solvedIds, setSolvedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved.solvedIds || {};
    } catch {
      return {};
    }
  });
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved.revealedIds || {};
    } catch {
      return {};
    }
  });
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved.bookmarkedIds || {};
    } catch {
      return {};
    }
  });
  const [solvedWorksheetItems, setSolvedWorksheetItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved.solvedWorksheetItems || {};
    } catch {
      return {};
    }
  });

  // Per-puzzle Hint State
  const [hintsByPuzzle, setHintsByPuzzle] = useState<Record<string, HintStateForPuzzle>>({});

  // Active Play Input State
  const [guessInput, setGuessInput] = useState<string>('');
  const [wrongAttempt, setWrongAttempt] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // 5-Round Sprint Mode State
  const [sprintActive, setSprintActive] = useState<boolean>(false);
  const [sprintQueue, setSprintQueue] = useState<RebusChallenge[]>([]);
  const [sprintIndex, setSprintIndex] = useState<number>(0);
  const [sprintResults, setSprintResults] = useState<SprintRunResult[]>([]);

  // 3-Second Post-Completion Next Puzzle Popup State
  const [completionState, setCompletionState] = useState<{
    status: 'idle' | 'counting' | 'open';
    puzzleId: string;
    outcome: 'solved' | 'revealed';
    pointsEarned: number;
    secondsLeft: number;
  }>({
    status: 'idle',
    puzzleId: '',
    outcome: 'solved',
    pointsEarned: 0,
    secondsLeft: 3,
  });

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          score,
          streak,
          bestStreak,
          solvedIds,
          revealedIds,
          bookmarkedIds,
          solvedWorksheetItems,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [score, streak, bestStreak, solvedIds, revealedIds, bookmarkedIds, solvedWorksheetItems]);

  // Filtered Deck for Play Mode (keep currentPuzzleId in deck even when unsolvedOnly is toggled so it doesn't vanish during the 3-second popup delay)
  const activeDeck = useMemo(() => {
    if (sprintActive && sprintQueue.length > 0) {
      return sprintQueue;
    }
    const filtered = INDIVIDUAL_PUZZLES.filter((p) => {
      if (deckCategory !== 'All' && p.category !== deckCategory) return false;
      if (unsolvedOnly && solvedIds[p.id] && p.id !== currentPuzzleId) return false;
      return true;
    });
    return filtered.length > 0 ? filtered : INDIVIDUAL_PUZZLES;
  }, [deckCategory, unsolvedOnly, solvedIds, currentPuzzleId, sprintActive, sprintQueue]);

  // Active Puzzle
  const currentPuzzle: RebusChallenge = useMemo(() => {
    if (sprintActive && sprintQueue[sprintIndex]) {
      return sprintQueue[sprintIndex];
    }
    return (
      activeDeck.find((p) => p.id === currentPuzzleId) ||
      INDIVIDUAL_PUZZLES.find((p) => p.id === currentPuzzleId) ||
      activeDeck[0] ||
      INDIVIDUAL_PUZZLES[0]
    );
  }, [activeDeck, currentPuzzleId, sprintActive, sprintQueue, sprintIndex]);

  const currentDeckIndex = useMemo(() => {
    const idx = activeDeck.findIndex((p) => p.id === currentPuzzle.id);
    return idx >= 0 ? idx : 0;
  }, [activeDeck, currentPuzzle.id]);

  // Reset input and completion popup when changing puzzle or tab
  useEffect(() => {
    setGuessInput('');
    setWrongAttempt(false);
    setFeedbackMessage(null);
    setCompletionState((prev) =>
      prev.status === 'idle' ? prev : { ...prev, status: 'idle', secondsLeft: 3 }
    );
  }, [currentPuzzle.id, activeTab]);

  // Manage 3-second countdown before opening the Next Puzzle popup
  useEffect(() => {
    if (completionState.status !== 'counting') return;

    const interval = window.setInterval(() => {
      setCompletionState((prev) => {
        if (prev.status !== 'counting') return prev;
        if (prev.secondsLeft <= 1) {
          return { ...prev, status: 'open', secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completionState.status]);

  // Word Slot Groups for the current puzzle
  const { groups: wordSlotGroups, totalLetters } = useMemo(
    () => buildWordSlotGroups(currentPuzzle.answer),
    [currentPuzzle.answer]
  );

  const currentHintState: HintStateForPuzzle = useMemo(() => {
    return (
      hintsByPuzzle[currentPuzzle.id] || {
        tier1Unlocked: true,
        tier2Unlocked: false,
        tier3Unlocked: false,
        revealedLetterIndices: [],
      }
    );
  }, [hintsByPuzzle, currentPuzzle.id]);

  const isCurrentSolved = Boolean(solvedIds[currentPuzzle.id]);
  const isCurrentRevealed = Boolean(revealedIds[currentPuzzle.id]);
  const isCurrentBookmarked = Boolean(bookmarkedIds[currentPuzzle.id]);

  // Calculate potential points for solving the current challenge
  const potentialPoints = useMemo(() => {
    const base =
      currentPuzzle.difficulty === 'Challenging'
        ? 120
        : currentPuzzle.difficulty === 'Medium'
        ? 100
        : 80;
    const t2Penalty = currentHintState.tier2Unlocked ? 15 : 0;
    const t3Penalty = currentHintState.tier3Unlocked ? 25 : 0;
    const t4Penalty = currentHintState.revealedLetterIndices.length * 10;
    return Math.max(20, base - t2Penalty - t3Penalty - t4Penalty);
  }, [currentPuzzle.difficulty, currentHintState]);

  // Unlock Hint Tier 2 (Official Clue)
  const handleUnlockTier2 = () => {
    if (currentHintState.tier2Unlocked || isCurrentSolved || isCurrentRevealed) return;
    soundEngine.playHint();
    setHintsByPuzzle((prev) => ({
      ...prev,
      [currentPuzzle.id]: {
        ...currentHintState,
        tier2Unlocked: true,
      },
    }));
  };

  // Unlock Hint Tier 3 (First Letter of Every Word)
  const handleUnlockTier3 = () => {
    if (currentHintState.tier3Unlocked || isCurrentSolved || isCurrentRevealed) return;
    soundEngine.playHint();
    const firstIndices = wordSlotGroups
      .map((g) => g.letters[0]?.globalIndex)
      .filter((n) => n !== undefined);
    const mergedIndices = Array.from(
      new Set([...currentHintState.revealedLetterIndices, ...firstIndices])
    );
    setHintsByPuzzle((prev) => ({
      ...prev,
      [currentPuzzle.id]: {
        ...currentHintState,
        tier3Unlocked: true,
        revealedLetterIndices: mergedIndices,
      },
    }));
  };

  // Unlock Hint Tier 4 (Reveal Next Single Unrevealed Letter)
  const handleRevealSingleLetter = () => {
    if (isCurrentSolved || isCurrentRevealed) return;
    const allIndices = Array.from({ length: totalLetters }, (_, i) => i);
    const unrevealed = allIndices.filter(
      (idx) => !currentHintState.revealedLetterIndices.includes(idx)
    );
    if (unrevealed.length === 0) return;

    soundEngine.playHint();
    const nextIdx = unrevealed[0];
    setHintsByPuzzle((prev) => ({
      ...prev,
      [currentPuzzle.id]: {
        ...currentHintState,
        revealedLetterIndices: [...currentHintState.revealedLetterIndices, nextIdx],
      },
    }));
  };

  // Submit Guess
  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCurrentSolved || isCurrentRevealed) return;
    if (!guessInput.trim()) return;

    const matched = checkAnswerMatch(guessInput, currentPuzzle);
    if (matched) {
      soundEngine.playSolve();
      const earned = potentialPoints;
      setScore((prev) => prev + earned);
      setStreak((prev) => {
        const next = prev + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      setSolvedIds((prev) => ({ ...prev, [currentPuzzle.id]: true }));
      setFeedbackMessage(`Correct! +${earned} points earned.`);
      setCompletionState({
        status: 'counting',
        puzzleId: currentPuzzle.id,
        outcome: 'solved',
        pointsEarned: earned,
        secondsLeft: 3,
      });

      if (sprintActive) {
        const hintsCount =
          (currentHintState.tier2Unlocked ? 1 : 0) +
          (currentHintState.tier3Unlocked ? 1 : 0) +
          currentHintState.revealedLetterIndices.length;
        setSprintResults((prev) => [
          ...prev,
          {
            puzzle: currentPuzzle,
            outcome: 'solved',
            pointsEarned: earned,
            hintsUsed: hintsCount,
          },
        ]);
      }
    } else {
      soundEngine.playWrong();
      setWrongAttempt(true);
      setFeedbackMessage(
        'Not quite right — check the word lengths or unlock a hint on the right.'
      );
      setTimeout(() => setWrongAttempt(false), 260);
    }
  };

  // Reveal Answer (Give Up on current challenge)
  const handleRevealAnswer = () => {
    if (isCurrentSolved || isCurrentRevealed) return;
    soundEngine.playClick();
    setRevealedIds((prev) => ({ ...prev, [currentPuzzle.id]: true }));
    setStreak(0);
    setFeedbackMessage(`Solution revealed: "${currentPuzzle.answer}"`);
    setCompletionState({
      status: 'counting',
      puzzleId: currentPuzzle.id,
      outcome: 'revealed',
      pointsEarned: 0,
      secondsLeft: 3,
    });

    if (sprintActive) {
      setSprintResults((prev) => [
        ...prev,
        {
          puzzle: currentPuzzle,
          outcome: 'revealed',
          pointsEarned: 0,
          hintsUsed: 0,
        },
      ]);
    }
  };

  // Navigate to Next / Previous / Random Challenge
  const handleNextChallenge = useCallback(() => {
    soundEngine.playClick();
    if (sprintActive) {
      if (!isCurrentSolved && !isCurrentRevealed) {
        setSprintResults((prev) => [
          ...prev,
          {
            puzzle: currentPuzzle,
            outcome: 'skipped',
            pointsEarned: 0,
            hintsUsed: 0,
          },
        ]);
      }
      if (sprintIndex + 1 < sprintQueue.length) {
        setSprintIndex((i) => i + 1);
      } else {
        setActiveTab('SPRINT_SUMMARY');
      }
      return;
    }

    const nextIdx = (currentDeckIndex + 1) % activeDeck.length;
    setCurrentPuzzleId(activeDeck[nextIdx].id);
  }, [
    sprintActive,
    isCurrentSolved,
    isCurrentRevealed,
    currentPuzzle,
    sprintIndex,
    sprintQueue.length,
    currentDeckIndex,
    activeDeck,
  ]);

  const handlePrevChallenge = () => {
    soundEngine.playClick();
    if (sprintActive) return;
    const prevIdx = (currentDeckIndex - 1 + activeDeck.length) % activeDeck.length;
    setCurrentPuzzleId(activeDeck[prevIdx].id);
  };

  const handleRandomChallenge = () => {
    soundEngine.playClick();
    if (sprintActive) return;
    const pool = activeDeck.filter((p) => p.id !== currentPuzzle.id);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setCurrentPuzzleId(pick.id);
  };

  // Start a 5-Round Sprint Run
  const handleStartSprint = () => {
    soundEngine.playClick();
    const unsolvedPool = INDIVIDUAL_PUZZLES.filter((p) => !solvedIds[p.id]);
    const sourcePool = unsolvedPool.length >= 5 ? unsolvedPool : INDIVIDUAL_PUZZLES;
    const shuffled = [...sourcePool].sort(() => Math.random() - 0.5).slice(0, 5);
    setSprintQueue(shuffled);
    setSprintIndex(0);
    setSprintResults([]);
    setSprintActive(true);
    setCurrentPuzzleId(shuffled[0].id);
    setActiveTab('PLAY_DECK');
  };

  const handleExitSprint = () => {
    setSprintActive(false);
    setSprintQueue([]);
    setSprintIndex(0);
    setActiveTab('PLAY_DECK');
  };

  const handleToggleBookmark = (puzzleId: string) => {
    soundEngine.playClick();
    setBookmarkedIds((prev) => ({
      ...prev,
      [puzzleId]: !prev[puzzleId],
    }));
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.enabled = next;
  };

  const handleMarkWorksheetItemSolved = (itemKey: string, pts: number) => {
    if (solvedWorksheetItems[itemKey]) return;
    setSolvedWorksheetItems((prev) => ({ ...prev, [itemKey]: true }));
    setScore((prev) => prev + pts);
    setStreak((prev) => {
      const next = prev + 1;
      setBestStreak((b) => Math.max(b, next));
      return next;
    });
  };

  // Map user's current typed characters into unrevealed slots for live visual preview
  const typedAlphanumeric = useMemo(
    () => guessInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().split(''),
    [guessInput]
  );

  const totalStandaloneSolved = Object.values(solvedIds).filter(Boolean).length;
  const totalWorksheetSolved = Object.values(solvedWorksheetItems).filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] dark:bg-[#0E1015] text-[#18181B] dark:text-zinc-100 transition-colors duration-150">
      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 transition-colors duration-150">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#play"
          onClick={(e) => {
            e.preventDefault();
            setSprintActive(false);
            setActiveTab('PLAY_DECK');
          }}
          className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-zinc-100 whitespace-nowrap shrink-0"
        >
          Puzzle a Day · Rebus
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-zinc-400">
          <a
            href="#play-deck"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('PLAY_DECK');
            }}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'PLAY_DECK'
                ? 'text-stone-900 dark:text-white underline underline-offset-8 decoration-2 decoration-[#0F5132] dark:decoration-emerald-400'
                : ''
            }`}
          >
            Play Deck ({INDIVIDUAL_PUZZLES.length})
          </a>
          <a
            href="#archive"
            onClick={(e) => {
              e.preventDefault();
              setSprintActive(false);
              setActiveTab('ARCHIVE');
            }}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ARCHIVE'
                ? 'text-stone-900 dark:text-white underline underline-offset-8 decoration-2 decoration-[#0F5132] dark:decoration-emerald-400'
                : ''
            }`}
          >
            Archive Catalog
          </a>
          <a
            href="#worksheets"
            onClick={(e) => {
              e.preventDefault();
              setSprintActive(false);
              setActiveTab('WORKSHEETS');
            }}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'WORKSHEETS'
                ? 'text-stone-900 dark:text-white underline underline-offset-8 decoration-2 decoration-[#0F5132] dark:decoration-emerald-400'
                : ''
            }`}
          >
            Worksheets & PDFs
          </a>
          <a
            href="#rules-stats"
            onClick={(e) => {
              e.preventDefault();
              setSprintActive(false);
              setActiveTab('RULES_STATS');
            }}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'RULES_STATS'
                ? 'text-stone-900 dark:text-white underline underline-offset-8 decoration-2 decoration-[#0F5132] dark:decoration-emerald-400'
                : ''
            }`}
          >
            Rules & Stats
          </a>
        </nav>

        {/* Zone 3: Dark Mode Selection Slider + 5-Round Sprint CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Dark Mode Selection Slider */}
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            aria-label="Toggle dark mode"
            onClick={() => {
              soundEngine.playClick();
              setDarkMode((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-[#FAF9F5] dark:bg-zinc-950 text-xs font-medium text-stone-700 dark:text-zinc-200 hover:border-stone-300 dark:hover:border-zinc-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <Sun
              className={`w-3.5 h-3.5 transition-colors ${
                !darkMode ? 'text-amber-500' : 'text-stone-400 dark:text-zinc-500'
              }`}
            />
            <span className="relative w-8 h-4 rounded-full bg-stone-300 dark:bg-emerald-600 transition-colors">
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                  darkMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            <Moon
              className={`w-3.5 h-3.5 transition-colors ${
                darkMode ? 'text-emerald-400' : 'text-stone-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleStartSprint}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] rounded-lg hover:bg-[#0B3D26] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Start 5-Round Sprint
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar (visible only on small screens) */}
      <div className="flex md:hidden items-center justify-around px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 text-xs font-medium text-stone-600 dark:text-zinc-400">
        <button
          type="button"
          onClick={() => setActiveTab('PLAY_DECK')}
          className={`py-1 whitespace-nowrap shrink-0 ${
            activeTab === 'PLAY_DECK'
              ? 'text-[#0F5132] dark:text-emerald-400 font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Play ({INDIVIDUAL_PUZZLES.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSprintActive(false);
            setActiveTab('ARCHIVE');
          }}
          className={`py-1 whitespace-nowrap shrink-0 ${
            activeTab === 'ARCHIVE'
              ? 'text-[#0F5132] dark:text-emerald-400 font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Archive ({INDIVIDUAL_PUZZLES.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSprintActive(false);
            setActiveTab('WORKSHEETS');
          }}
          className={`py-1 whitespace-nowrap shrink-0 ${
            activeTab === 'WORKSHEETS'
              ? 'text-[#0F5132] dark:text-emerald-400 font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          PDFs & Sheets ({WORKSHEET_GRIDS.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSprintActive(false);
            setActiveTab('RULES_STATS');
          }}
          className={`py-1 whitespace-nowrap shrink-0 ${
            activeTab === 'RULES_STATS'
              ? 'text-[#0F5132] dark:text-emerald-400 font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Stats
        </button>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'PLAY_DECK' && (
          <div className="space-y-6">
            {/* Workspace Control & Deck Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {sprintActive ? (
                <div className="flex flex-wrap items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-display font-semibold text-stone-900 dark:text-zinc-100">
                      5-Round Rebus Sprint
                    </span>
                    <span className="text-stone-400 dark:text-zinc-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono text-xs text-stone-700 dark:text-zinc-300 tabular-nums">
                      Round {sprintIndex + 1} of {sprintQueue.length}
                    </span>
                    <span className="text-stone-400 dark:text-zinc-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono text-xs text-[#0F5132] dark:text-emerald-400 font-semibold tabular-nums">
                      Sprint Score: {sprintResults.reduce((s, r) => s + r.pointsEarned, 0)} pts
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExitSprint}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Exit Sprint Mode
                  </button>
                </div>
              ) : (
                <>
                  {/* Category, Puzzle Selector & Unsolved Filter Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="deck-category"
                      className="text-xs font-medium text-stone-600 dark:text-zinc-400 whitespace-nowrap"
                    >
                      Category Deck:
                    </label>
                    <select
                      id="deck-category"
                      value={deckCategory}
                      onChange={(e) => {
                        const nextCat = e.target.value;
                        setDeckCategory(nextCat);
                        const firstMatch = INDIVIDUAL_PUZZLES.find(
                          (p) =>
                            (nextCat === 'All' || p.category === nextCat) &&
                            (!unsolvedOnly || !solvedIds[p.id])
                        );
                        if (firstMatch) setCurrentPuzzleId(firstMatch.id);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
                    >
                      <option value="All">All Main Game Puzzles (926)</option>
                      <option value="JFF PDF: 100 Easy Rebuses">
                        JFF PDF: 100 Easy Rebuses (100)
                      </option>
                      <option value="JFF PDF: 100 Common Sayings">
                        JFF PDF: 100 Common Sayings (100)
                      </option>
                      <option value="JFF PDF: 144 Great Quest">
                        JFF PDF: 144 Great Quest (144)
                      </option>
                      <option value="JFF PDF: 7 Themed Packs">
                        JFF PDF: 7 Themed Packs (144)
                      </option>
                      <option value="Just Family Fun Spotlight">
                        Just Family Fun Spotlight (9)
                      </option>
                      <option value="Three Rebus Series">Three Rebus Series (323)</option>
                      <option value="Multi-Pack Series">Multi-Pack Series (27)</option>
                      <option value="Single Spotlight">Single Spotlight (24)</option>
                      <option value="Typographic Rebus">Typographic Rebus (23)</option>
                      <option value="Challenging">Challenging Specials (14)</option>
                      <option value="Mystery Theme">Mystery Theme Trios (6)</option>
                      <option value="History & Culture">History & Presidential (4)</option>
                      <option value="1% Club Special">1% Club UK Specials (3)</option>
                      <option value="Names & People">Names & People (3)</option>
                      <option value="Movies & Pop Culture">Movies & Pop Culture (2)</option>
                    </select>

                    {/* Sequential Puzzle Picker (Rebus Puzzle #1 .. #926) */}
                    <select
                      aria-label="Select Rebus Puzzle by number"
                      value={currentPuzzle.id}
                      onChange={(e) => setCurrentPuzzleId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono font-medium bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
                    >
                      {activeDeck.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {solvedIds[p.id] ? '✓' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setUnsolvedOnly((prev) => !prev)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        unsolvedOnly
                          ? 'bg-[#0F5132] text-white border-[#0F5132]'
                          : 'bg-[#FAF9F5] dark:bg-zinc-950 text-stone-700 dark:text-zinc-300 border-stone-300 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {unsolvedOnly ? 'Showing Unsolved Only' : 'Filter Unsolved'}
                    </button>
                  </div>

                  {/* Challenge Navigation Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs font-mono text-stone-500 dark:text-zinc-400 tabular-nums mr-2 whitespace-nowrap">
                      {currentPuzzle.title} ({currentDeckIndex + 1} of {activeDeck.length})
                    </span>

                    <button
                      type="button"
                      onClick={handlePrevChallenge}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Previous puzzle"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRandomChallenge}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Pick random challenge"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Random</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextChallenge}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Next puzzle"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(currentPuzzle.id)}
                      aria-label={isCurrentBookmarked ? 'Remove bookmark' : 'Bookmark challenge'}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                        isCurrentBookmarked
                          ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                          : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Bookmark
                        className="w-4 h-4"
                        fill={isCurrentBookmarked ? 'currentColor' : 'none'}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSound}
                      aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                      className="p-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
                      title={soundEnabled ? 'Sound FX On' : 'Sound FX Muted'}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 2-Column Main Gameplay Split (7 Cols Stage & Input / 5 Cols Progressive Hints & Telemetry) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Columns: Rebus Stage, Interactive Word Slots, & Answer Input */}
              <div className="lg:col-span-7 space-y-6">
                {/* Quiet Unboxed Metadata Kicker */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
                  <span className="font-semibold text-stone-800 dark:text-zinc-200">
                    {currentPuzzle.title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{currentPuzzle.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Difficulty: {currentPuzzle.difficulty}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Reward: {potentialPoints} pts</span>
                </div>

                {/* Visual / Typographic Rebus Stage */}
                <RebusVisualStage puzzle={currentPuzzle} isSolved={isCurrentSolved} />

                {/* Interactive Word & Letter Slot Board */}
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
                    <span>
                      Answer Blueprint · {wordSlotGroups.length}{' '}
                      {wordSlotGroups.length === 1 ? 'Word' : 'Words'} (
                      {currentPuzzle.wordPattern.join(', ')} letters)
                    </span>
                    <span className="font-mono tabular-nums">
                      {currentHintState.revealedLetterIndices.length} / {totalLetters} letters
                      revealed
                    </span>
                  </div>

                  {/* Word Slot Groups */}
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 py-2">
                    {wordSlotGroups.map((group) => (
                      <div key={group.wordIndex} className="flex items-center gap-1.5">
                        {group.letters.map((slot) => {
                          const isHintRevealed = currentHintState.revealedLetterIndices.includes(
                            slot.globalIndex
                          );
                          const showFullAnswer = isCurrentSolved || isCurrentRevealed;
                          const typedChar = typedAlphanumeric[slot.globalIndex] || '';

                          return (
                            <div
                              key={slot.globalIndex}
                              className={`w-8 h-10 sm:w-9 sm:h-11 rounded-lg border flex items-center justify-center font-mono text-base sm:text-lg font-semibold transition-all duration-150 select-none ${
                                isCurrentSolved
                                  ? 'bg-[#0F5132] border-[#0F5132] text-white'
                                  : isCurrentRevealed
                                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-300'
                                  : isHintRevealed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#0F5132]/50 dark:border-emerald-500/50 text-[#0F5132] dark:text-emerald-400'
                                  : typedChar
                                  ? 'bg-stone-100 dark:bg-zinc-800 border-stone-400 dark:border-zinc-500 text-stone-900 dark:text-zinc-100'
                                  : 'bg-[#FAF9F5] dark:bg-zinc-950 border-stone-300 dark:border-zinc-700 text-stone-400 dark:text-zinc-500'
                              }`}
                            >
                              {showFullAnswer || isHintRevealed ? slot.char : typedChar || ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Answer Input Form */}
                  {!isCurrentSolved && !isCurrentRevealed ? (
                    <form onSubmit={handleGuessSubmit} className="space-y-3">
                      <div
                        className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${
                          wrongAttempt ? 'animate-shake' : ''
                        }`}
                      >
                        <input
                          type="text"
                          value={guessInput}
                          onChange={(e) => {
                            setGuessInput(e.target.value);
                            if (feedbackMessage) setFeedbackMessage(null);
                          }}
                          placeholder={`Solve ${currentPuzzle.title} (${currentPuzzle.wordPattern.join(', ')} letters)...`}
                          aria-label="Your rebus puzzle answer"
                          className="flex-1 px-4 py-3 text-base bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-300 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#0F5132] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                        />

                        <button
                          type="submit"
                          className="px-6 py-3 text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Submit Answer
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <span
                          className={
                            wrongAttempt
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-stone-500 dark:text-zinc-400'
                          }
                        >
                          {feedbackMessage ||
                            'Punctuation and capitalization are ignored automatically.'}
                        </span>

                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={handleRevealSingleLetter}
                            className="inline-flex items-center gap-1 font-medium text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Reveal Letter (-10 pts)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRevealAnswer}
                            className="inline-flex items-center gap-1 font-medium text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Reveal Answer</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    /* Solved or Revealed Explanation Card */
                    <div
                      className={`p-5 rounded-xl border space-y-3 ${
                        isCurrentSolved
                          ? 'bg-[#0F5132]/[0.04] dark:bg-emerald-950/25 border-[#0F5132]/30 dark:border-emerald-500/40'
                          : 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200 dark:border-amber-700/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isCurrentSolved ? (
                            <CheckCircle2 className="w-5 h-5 text-[#0F5132] dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Eye className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
                          )}
                          <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                            {currentPuzzle.answer}
                          </h3>
                        </div>

                        <span className="text-xs font-mono font-semibold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                          {isCurrentSolved ? `+${potentialPoints} PTS EARNED` : 'SOLUTION REVEALED'}
                        </span>
                      </div>

                      <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                        <strong className="text-stone-900 dark:text-zinc-100">
                          Puzzle Breakdown:
                        </strong>{' '}
                        {currentPuzzle.explanation}
                      </p>

                      {currentPuzzle.acceptedAnswers.length > 1 && (
                        <p className="text-xs text-stone-500 dark:text-zinc-400">
                          Accepted variations: {currentPuzzle.acceptedAnswers.join(' · ')}
                        </p>
                      )}

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={currentPuzzle.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                          >
                            <span>
                              Read original post on{' '}
                              {currentPuzzle.source === 'Just Family Fun'
                                ? 'Just Family Fun'
                                : 'Puzzle a Day'}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {completionState.status === 'counting' &&
                            completionState.puzzleId === currentPuzzle.id && (
                              <span className="text-xs font-mono text-[#0F5132] dark:text-emerald-400 tabular-nums">
                                · Next puzzle prompt in {completionState.secondsLeft}s...
                              </span>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={handleNextChallenge}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>
                            {sprintActive && sprintIndex + 1 >= sprintQueue.length
                              ? 'Finish Sprint Summary'
                              : 'Next Challenge'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 Columns: 4-Tier Progressive Hint System & Session Scoreboard */}
              <div className="lg:col-span-5 space-y-6">
                {/* 4-Tier Progressive Hint System Card */}
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">
                        Progressive Assistance
                      </div>
                      <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                        Challenge Hint System
                      </h2>
                    </div>
                    <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  </div>

                  <div className="space-y-3">
                    {/* Tier 1: Word & Letter Architecture (Always Unlocked / Free) */}
                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/90 dark:border-zinc-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-900 dark:text-zinc-100">
                          01. Word & Letter Structure
                        </span>
                        <span className="font-mono text-stone-500 dark:text-zinc-400">
                          Free Clue
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                        The solution has{' '}
                        <strong className="text-stone-900 dark:text-zinc-100 font-mono">
                          {currentPuzzle.wordPattern.length}
                        </strong>{' '}
                        {currentPuzzle.wordPattern.length === 1 ? 'word' : 'words'} with letter
                        counts{' '}
                        <strong className="text-stone-900 dark:text-zinc-100 font-mono">
                          ({currentPuzzle.wordPattern.join(', ')})
                        </strong>{' '}
                        — {totalLetters} letters in total.
                      </p>
                    </div>

                    {/* Tier 2: Official Clue (-15 pts) */}
                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/90 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-stone-900 dark:text-zinc-100">
                          02. Official Challenge Clue
                        </span>
                        {currentHintState.tier2Unlocked ||
                        isCurrentSolved ||
                        isCurrentRevealed ? (
                          <span className="font-mono text-[#0F5132] dark:text-emerald-400 font-medium">
                            Unlocked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleUnlockTier2}
                            className="px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Unlock Clue (-15 pts)
                          </button>
                        )}
                      </div>
                      {currentHintState.tier2Unlocked || isCurrentSolved || isCurrentRevealed ? (
                        <p className="text-xs text-stone-700 dark:text-zinc-300 leading-relaxed">
                          {currentPuzzle.blogClue}
                        </p>
                      ) : (
                        <p className="text-xs text-stone-400 dark:text-zinc-500">
                          Reveals the official hint published for {currentPuzzle.title}.
                        </p>
                      )}
                    </div>

                    {/* Tier 3: First Letters Lock-In (-25 pts) */}
                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/90 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-stone-900 dark:text-zinc-100">
                          03. First-Letter Word Anchors
                        </span>
                        {currentHintState.tier3Unlocked ||
                        isCurrentSolved ||
                        isCurrentRevealed ? (
                          <span className="font-mono text-[#0F5132] dark:text-emerald-400 font-medium">
                            Unlocked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleUnlockTier3}
                            className="px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Lock First Letters (-25 pts)
                          </button>
                        )}
                      </div>
                      {currentHintState.tier3Unlocked || isCurrentSolved || isCurrentRevealed ? (
                        <p className="text-xs text-stone-700 dark:text-zinc-300 font-mono">
                          First letter of each word:{' '}
                          <strong className="text-stone-900 dark:text-zinc-100">
                            {currentPuzzle.firstLetters}
                          </strong>
                        </p>
                      ) : (
                        <p className="text-xs text-stone-400 dark:text-zinc-500">
                          Reveals the starting letter of every word and populates them directly into
                          the answer boxes.
                        </p>
                      )}
                    </div>

                    {/* Tier 4: Single Letter Slot Reveal (-10 pts per letter) */}
                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/90 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-stone-900 dark:text-zinc-100">
                          04. Single-Letter Slot Reveal
                        </span>
                        <button
                          type="button"
                          disabled={
                            isCurrentSolved ||
                            isCurrentRevealed ||
                            currentHintState.revealedLetterIndices.length >= totalLetters
                          }
                          onClick={handleRevealSingleLetter}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reveal Next Letter (-10 pts)</span>
                        </button>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-zinc-400">
                        Reveals the next missing letter directly in the answer blueprint boxes (
                        {currentHintState.revealedLetterIndices.length} of {totalLetters} revealed).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Session Progress & Archive Telemetry Card */}
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Player Record</div>
                      <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                        Archive Progress
                      </h2>
                    </div>
                    <Compass className="w-5 h-5 text-[#0F5132] dark:text-emerald-400 shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/80 dark:border-zinc-800">
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Total Score</div>
                      <div className="font-mono text-2xl font-semibold text-stone-900 dark:text-zinc-100 tabular-nums mt-0.5">
                        {score.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/80 dark:border-zinc-800">
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Win Streak</div>
                      <div className="font-mono text-2xl font-semibold text-[#0F5132] dark:text-emerald-400 tabular-nums mt-0.5">
                        {streak}{' '}
                        <span className="text-xs font-normal text-stone-500 dark:text-zinc-400">
                          (Best {bestStreak})
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/80 dark:border-zinc-800">
                      <div className="text-xs text-stone-500 dark:text-zinc-400">
                        Main Game Solved
                      </div>
                      <div className="font-mono text-lg font-semibold text-stone-900 dark:text-zinc-100 tabular-nums mt-0.5">
                        {totalStandaloneSolved} / {INDIVIDUAL_PUZZLES.length}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/80 dark:border-zinc-800">
                      <div className="text-xs text-stone-500 dark:text-zinc-400">
                        Worksheet Items
                      </div>
                      <div className="font-mono text-lg font-semibold text-stone-900 dark:text-zinc-100 tabular-nums mt-0.5">
                        {totalWorksheetSolved} / 792
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      Rebus Puzzle #1 – #{INDIVIDUAL_PUZZLES.length}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('WORKSHEETS')}
                        className="font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        53 PDF & Sheet Sets →
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ARCHIVE')}
                        className="font-semibold text-stone-700 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        All {INDIVIDUAL_PUZZLES.length} Cards →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archive Browser Tab */}
        {activeTab === 'ARCHIVE' && (
          <ArchiveBrowserView
            puzzles={INDIVIDUAL_PUZZLES}
            solvedIds={solvedIds}
            revealedIds={revealedIds}
            bookmarkedIds={bookmarkedIds}
            onSelectPuzzle={(puzzleId) => {
              setSprintActive(false);
              setDeckCategory('All');
              setUnsolvedOnly(false);
              setCurrentPuzzleId(puzzleId);
              setActiveTab('PLAY_DECK');
            }}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {/* Multi-Puzzle Worksheet Grids Tab */}
        {activeTab === 'WORKSHEETS' && (
          <WorksheetSolverView
            solvedWorksheetItems={solvedWorksheetItems}
            onMarkWorksheetItemSolved={handleMarkWorksheetItemSolved}
          />
        )}

        {/* 5-Round Sprint Summary Modal / View */}
        {activeTab === 'SPRINT_SUMMARY' && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="text-xs text-stone-500 dark:text-zinc-400">
                  5-Round Sprint Complete
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-zinc-100">
                  Sprint Scorecard
                </h2>
              </div>
              <Trophy className="w-8 h-8 text-[#0F5132] dark:text-emerald-400 shrink-0" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-center">
                <div className="text-xs text-stone-500 dark:text-zinc-400">Sprint Points</div>
                <div className="font-mono text-2xl font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums mt-1">
                  +{sprintResults.reduce((acc, r) => acc + r.pointsEarned, 0)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-center">
                <div className="text-xs text-stone-500 dark:text-zinc-400">Solved</div>
                <div className="font-mono text-2xl font-bold text-stone-900 dark:text-zinc-100 tabular-nums mt-1">
                  {sprintResults.filter((r) => r.outcome === 'solved').length} /{' '}
                  {sprintQueue.length}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-center">
                <div className="text-xs text-stone-500 dark:text-zinc-400">Hints Used</div>
                <div className="font-mono text-2xl font-bold text-stone-900 dark:text-zinc-100 tabular-nums mt-1">
                  {sprintResults.reduce((acc, r) => acc + r.hintsUsed, 0)}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-stone-600 dark:text-zinc-400">
                Round-by-Round Breakdown
              </h3>
              {sprintResults.map((res, idx) => (
                <div
                  key={res.puzzle.id}
                  className="p-3.5 rounded-lg border border-stone-200 dark:border-zinc-800 bg-[#FAF9F5] dark:bg-zinc-950 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900 dark:text-zinc-100 truncate">
                      {idx + 1}. {res.puzzle.title} — {res.puzzle.answer}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-zinc-400 truncate">
                      {res.puzzle.category} · {res.puzzle.explanation}
                    </div>
                  </div>
                  <div className="font-mono text-xs font-semibold tabular-nums shrink-0">
                    {res.outcome === 'solved' ? (
                      <span className="text-[#0F5132] dark:text-emerald-400">
                        +{res.pointsEarned} pts
                      </span>
                    ) : (
                      <span className="text-stone-400 dark:text-zinc-500 uppercase">
                        {res.outcome}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleExitSprint}
                className="px-4 py-2.5 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Return to Full Deck
              </button>
              <button
                type="button"
                onClick={handleStartSprint}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Rules, Category Breakdown & Reset Stats Tab */}
        {activeTab === 'RULES_STATS' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 space-y-4">
              <div className="text-xs text-stone-500 dark:text-zinc-400">
                How to Decode Rebus Challenges
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-zinc-100">
                Rules of Rebus & Scoring Guide
              </h2>
              <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                Every challenge in this archive is sourced from the{' '}
                <a
                  href="https://puzzleaday.wordpress.com/category/rebus/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F5132] dark:text-emerald-400 underline"
                >
                  Puzzle a Day Rebus Archive
                </a>{' '}
                and the{' '}
                <a
                  href="https://justfamilyfun.com/100-printable-rebus-puzzles-with-answers-2025/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F5132] dark:text-emerald-400 underline"
                >
                  Just Family Fun Printable Rebus Collection
                </a>
                , with all 926 standalone challenges (including all 488 PDF rebus puzzles separated
                into individual cards) sequentially ordered as{' '}
                <strong>Rebus Puzzle #1 through Rebus Puzzle #926</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-1.5">
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                    01. Spatial Position & Direction
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                    Look at where words sit relative to one another: words placed above, below,
                    inside, backwards, or descending vertically encode prepositions like{' '}
                    <em>over, under, in, on, back,</em> or <em>up</em> (e.g., &ldquo;CON&rdquo;
                    written downwards = <em>Condescending</em>).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-1.5">
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                    02. Missing or Extra Letters
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                    Inspect spelling carefully: missing letters often mean &ldquo;no&rdquo; or
                    &ldquo;-less&rdquo; (e.g., <em>_ENTURY</em> = &ldquo;no C&rdquo; ={' '}
                    <em>Long time no see</em>; <em>OERATION</em> missing P-A-I-N ={' '}
                    <em>Painless operation</em>).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-1.5">
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                    03. Counts, Colors & Typography
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                    Count how many times a word or symbol repeats (e.g., four B&rsquo;s ={' '}
                    <em>before</em>; eight O&rsquo;s = <em>eight-oes</em>), and pay attention to font
                    weight, color, or size (e.g., a tiny &ldquo;do&rdquo; in <em>doCTOR</em> ={' '}
                    <em>Dr. Dolittle</em>).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-1.5">
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                    04. Multi-Tier Progressive Hint System
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                    Each challenge starts with word-length counts for free. You can unlock the
                    official Challenge Clue (-15 pts), lock the first letter of each word into the
                    grid (-25 pts), or reveal individual letters (-10 pts each).
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100">
                  Reset Local Progress
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Clears your saved score ({score.toLocaleString()} pts), solved checkmarks (
                  {totalStandaloneSolved + totalWorksheetSolved} solved), and bookmarks from this
                  browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScore(0);
                  setStreak(0);
                  setBestStreak(0);
                  setSolvedIds({});
                  setRevealedIds({});
                  setBookmarkedIds({});
                  setSolvedWorksheetItems({});
                  setHintsByPuzzle({});
                  localStorage.removeItem(STORAGE_KEY);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Saved Progress</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3-Second Delayed Next Puzzle Prompt Modal */}
      {completionState.status === 'open' &&
        completionState.puzzleId === currentPuzzle.id &&
        activeTab === 'PLAY_DECK' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-puzzle-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-[2px] transition-opacity duration-150"
          >
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-stone-500 dark:text-zinc-400 font-mono tabular-nums">
                    {currentPuzzle.title} · {currentPuzzle.category}
                  </div>
                  <h2
                    id="next-puzzle-modal-title"
                    className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-100"
                  >
                    {completionState.outcome === 'solved'
                      ? 'Challenge Completed!'
                      : 'Ready for the Next Puzzle?'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCompletionState((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }))
                  }
                  aria-label="Close prompt"
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/90 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-zinc-400">Solution</span>
                  {completionState.outcome === 'solved' ? (
                    <span className="font-mono font-semibold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                      +{completionState.pointsEarned} pts · Streak {streak}
                    </span>
                  ) : (
                    <span className="font-mono text-amber-800 dark:text-amber-400">
                      Answer Revealed
                    </span>
                  )}
                </div>
                <div className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                  {currentPuzzle.answer}
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                  {currentPuzzle.explanation}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCompletionState((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }))
                  }
                  className="px-3.5 py-2.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Stay Here
                </button>

                {!sprintActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompletionState((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }));
                      handleRandomChallenge();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-stone-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Random Puzzle</span>
                  </button>
                )}

                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setCompletionState((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }));
                    handleNextChallenge();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    {sprintActive && sprintIndex + 1 >= sprintQueue.length
                      ? 'View Sprint Summary'
                      : 'Next Puzzle'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Quiet Editorial Footer */}
      <footer className="mt-12 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5 text-xs text-stone-500 dark:text-zinc-400 transition-colors duration-150">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>Puzzle a Day & Just Family Fun Rebus Archive</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>
              Rebus Puzzle #1 – #926 · 53 Printable PDF & Worksheet Sets
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://puzzleaday.wordpress.com/category/rebus/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              puzzleaday.wordpress.com
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://justfamilyfun.com/100-printable-rebus-puzzles-with-answers-2025/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              justfamilyfun.com (36 Printable PDFs)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
