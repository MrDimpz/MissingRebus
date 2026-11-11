/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  INDIVIDUAL_PUZZLES,
  WORKSHEET_GRIDS,
  RebusChallenge,
} from './data/rebusData';
import { checkAnswerMatch, normalizePhrase } from './utils/matcher';
import { soundEngine } from './utils/sound';
import { RebusVisualStage } from './components/RebusVisualStage';
import { ArchiveBrowserView } from './components/ArchiveBrowserView';
import { WorksheetSolverView } from './components/WorksheetSolverView';
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Lightbulb,
  CheckCircle2,
  Eye,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Timer,
  Flame,
  Trophy,
  ArrowRight,
  X,
  Sun,
  Moon,
  Palette,
  Play,
  Tv,
  Maximize2,
  Minimize2,
} from 'lucide-react';

type NavTab = 'play' | 'archive' | 'worksheets' | 'rules';
type BrandTheme = 'logo' | 'classic';

interface GameProgress {
  solvedIds: Record<string, boolean>;
  revealedIds: Record<string, boolean>;
  worksheetSolved: Record<string, boolean>;
  hintsUsedByPuzzle: Record<string, number>;
  score: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedId: string;
}

const STORAGE_KEY = 'pad_rebus_edition_v3';
const THEME_STORAGE_KEY = 'pad_rebus_dark_mode_v1';
const BRAND_THEME_STORAGE_KEY = 'pad_rebus_brand_theme_v1';

const INITIAL_PROGRESS: GameProgress = {
  solvedIds: {},
  revealedIds: {},
  worksheetSolved: {},
  hintsUsedByPuzzle: {},
  score: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedId: INDIVIDUAL_PUZZLES[0]?.id || '',
};

const PUZZLE_CATEGORIES = [
  'JFF PDF: 100 Easy Rebuses',
  'JFF PDF: 100 Common Sayings',
  'JFF PDF: 144 Great Quest',
  'JFF PDF: 7 Themed Packs',
  'Just Family Fun Spotlight',
  'Three Rebus Series',
  'Single Spotlight',
  'Multi-Pack Series',
  'Typographic Rebus',
  'Challenging',
  'Mystery Theme',
  'History & Culture',
  '1% Club Special',
  'Names & People',
  'Movies & Pop Culture',
];

function getHintTiers(puzzle: RebusChallenge) {
  const words = puzzle.answer.trim().split(/\s+/);
  const wordLengths = words.map((w) => w.replace(/[^a-zA-Z0-9]/g, '').length);
  const firstLetters = words
    .map((w) => {
      const m = w.match(/[a-zA-Z0-9]/);
      return m ? `${m[0].toUpperCase()}...` : w;
    })
    .join(' ');
  const vowelsRevealed = words
    .map((w) =>
      w
        .split('')
        .map((ch, idx) => {
          if (!/[a-zA-Z0-9]/.test(ch)) return ch;
          if (idx === 0 || /[aeiouAEIOU]/.test(ch)) return ch.toUpperCase();
          return '_';
        })
        .join('')
    )
    .join('   ');

  return [
    {
      tier: 1,
      label: 'Word Structure',
      content: `${words.length} ${words.length === 1 ? 'word' : 'words'} — Letter lengths: (${wordLengths.join(', ')})`,
    },
    {
      tier: 2,
      label: 'Starting Letters',
      content: `Starts with: ${firstLetters}`,
    },
    {
      tier: 3,
      label: 'Editorial Clue',
      content: puzzle.blogClue || puzzle.explanation,
    },
    {
      tier: 4,
      label: 'Vowel Blueprint',
      content: `Pattern: ${vowelsRevealed}`,
    },
  ];
}

export default function App() {
  const [progress, setProgress] = useState<GameProgress>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_PROGRESS, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_PROGRESS;
  });

  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return false;
  });

  // Brand Theme State ('logo' = Royal Purple & Metallic Gold from user's logo by default; 'classic' = Emerald & Paper)
  const [brandTheme, setBrandTheme] = useState<BrandTheme>(() => {
    try {
      const saved = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
      if (saved === 'classic' || saved === 'logo') return saved;
    } catch {
      // ignore
    }
    return 'logo';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(darkMode));
    } catch {
      // ignore
    }
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(BRAND_THEME_STORAGE_KEY, brandTheme);
    } catch {
      // ignore
    }
    if (brandTheme === 'classic') {
      document.documentElement.classList.add('theme-classic');
    } else {
      document.documentElement.classList.remove('theme-classic');
    }
  }, [brandTheme]);

  const [activeTab, setActiveTab] = useState<NavTab>('play');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [unsolvedOnly, setUnsolvedOnly] = useState<boolean>(false);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string>(
    progress.lastPlayedId || INDIVIDUAL_PUZZLES[0].id
  );

  // Solver state
  const [guessInput, setGuessInput] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'correct' | 'wrong' | 'almost' | 'revealed'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [confirmReveal, setConfirmReveal] = useState<boolean>(false);

  // Sync soundEngine enabled flag
  useEffect(() => {
    soundEngine.enabled = soundEnabled;
  }, [soundEnabled]);

  // 3-second delayed Next Puzzle completion modal state
  const [showNextPuzzleModal, setShowNextPuzzleModal] = useState<boolean>(false);
  const [completedPuzzleSnapshot, setCompletedPuzzleSnapshot] = useState<{
    title: string;
    answer: string;
    pointsEarned: number;
  } | null>(null);

  // 5-Round Sprint Mode state
  const [sprintActive, setSprintActive] = useState<boolean>(false);
  const [sprintQueue, setSprintQueue] = useState<string[]>([]);
  const [sprintIndex, setSprintIndex] = useState<number>(0);
  const [sprintScore, setSprintScore] = useState<number>(0);
  const [sprintSeconds, setSprintSeconds] = useState<number>(0);
  const [sprintFinished, setSprintFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Intro Video Screen state
  const [showIntroScreen, setShowIntroScreen] = useState<boolean>(true);
  const [introVideoFinished, setIntroVideoFinished] = useState<boolean>(false);
  const [introMuted, setIntroMuted] = useState<boolean>(true);
  const introVideoRef = useRef<HTMLVideoElement>(null);

  // Stream Mode state (full screen puzzle + answer entry box)
  const [streamMode, setStreamMode] = useState<boolean>(false);

  // Auto-trigger 12-second timer when intro screen is shown
  useEffect(() => {
    if (!showIntroScreen) return;
    setIntroVideoFinished(false);
    const timer = setTimeout(() => {
      setIntroVideoFinished(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [showIntroScreen]);

  useEffect(() => {
    if (introVideoRef.current) {
      introVideoRef.current.muted = introMuted;
    }
  }, [introMuted]);

  // Save progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
  }, [progress]);

  // Sprint timer
  useEffect(() => {
    if (!sprintActive || sprintFinished) return;
    const interval = setInterval(() => {
      setSprintSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [sprintActive, sprintFinished]);

  // Filtered deck for play navigation
  const activeDeck = useMemo(() => {
    if (sprintActive && sprintQueue.length > 0) {
      return sprintQueue
        .map((id) => INDIVIDUAL_PUZZLES.find((p) => p.id === id))
        .filter((p): p is RebusChallenge => Boolean(p));
    }

    return INDIVIDUAL_PUZZLES.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (unsolvedOnly && progress.solvedIds[p.id]) return false;
      return true;
    });
  }, [selectedCategory, unsolvedOnly, progress.solvedIds, sprintActive, sprintQueue]);

  // Current puzzle object
  const currentPuzzle = useMemo(() => {
    if (sprintActive && sprintQueue[sprintIndex]) {
      const found = INDIVIDUAL_PUZZLES.find((p) => p.id === sprintQueue[sprintIndex]);
      if (found) return found;
    }
    const foundInDeck = activeDeck.find((p) => p.id === currentPuzzleId);
    if (foundInDeck) return foundInDeck;
    if (activeDeck.length > 0) return activeDeck[0];
    return INDIVIDUAL_PUZZLES[0];
  }, [activeDeck, currentPuzzleId, sprintActive, sprintQueue, sprintIndex]);

  // Sync currentPuzzleId when deck changes
  useEffect(() => {
    if (!sprintActive && currentPuzzle && currentPuzzle.id !== currentPuzzleId) {
      setCurrentPuzzleId(currentPuzzle.id);
    }
  }, [currentPuzzle, currentPuzzleId, sprintActive]);

  // Reset local input state when switching puzzles
  useEffect(() => {
    setGuessInput('');
    setConfirmReveal(false);
    setShowNextPuzzleModal(false);
    const isAlreadySolved = progress.solvedIds[currentPuzzle.id];
    const isAlreadyRevealed = progress.revealedIds[currentPuzzle.id];

    if (isAlreadySolved) {
      setFeedbackStatus('correct');
      setFeedbackMessage('Solved! You decoded this rebus.');
    } else if (isAlreadyRevealed) {
      setFeedbackStatus('revealed');
      setFeedbackMessage('Answer revealed.');
    } else {
      setFeedbackStatus('idle');
      setFeedbackMessage('');
    }

    setProgress((prev) => ({ ...prev, lastPlayedId: currentPuzzle.id }));
  }, [currentPuzzle.id]);

  // Trigger popup 3 seconds after a puzzle is completed
  useEffect(() => {
    if (!completedPuzzleSnapshot) return;
    const timer = setTimeout(() => {
      setShowNextPuzzleModal(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [completedPuzzleSnapshot]);

  const currentDeckIndex = useMemo(() => {
    return activeDeck.findIndex((p) => p.id === currentPuzzle.id);
  }, [activeDeck, currentPuzzle.id]);

  const hintsUnlocked = progress.hintsUsedByPuzzle[currentPuzzle.id] || 0;
  const hintTiers = useMemo(() => getHintTiers(currentPuzzle), [currentPuzzle]);

  const isSolved = Boolean(progress.solvedIds[currentPuzzle.id]);
  const isRevealed = Boolean(progress.revealedIds[currentPuzzle.id]);

  // Calculate potential points for current puzzle
  const potentialPoints = useMemo(() => {
    const base =
      currentPuzzle.difficulty === 'Challenging'
        ? 120
        : currentPuzzle.difficulty === 'Medium'
        ? 100
        : 80;
    const penalty = hintsUnlocked * 15;
    return Math.max(20, base - penalty);
  }, [currentPuzzle.difficulty, hintsUnlocked]);

  // Check if user guess is close (e.g. matching some words)
  const checkAlmostMatch = (guess: string, target: string): boolean => {
    const gWords = normalizePhrase(guess).split(' ').filter(Boolean);
    const tWords = normalizePhrase(target).split(' ').filter(Boolean);
    if (gWords.length === 0 || tWords.length <= 1) return false;
    const matches = gWords.filter((w) => tWords.includes(w));
    return matches.length >= Math.ceil(tWords.length / 2);
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    if (checkAnswerMatch(guessInput, currentPuzzle)) {
      soundEngine.playSolve();
      setFeedbackStatus('correct');
      setFeedbackMessage(`Spot on! +${potentialPoints} points`);

      if (!progress.solvedIds[currentPuzzle.id]) {
        const newStreak = progress.currentStreak + 1;
        setProgress((prev) => ({
          ...prev,
          solvedIds: { ...prev.solvedIds, [currentPuzzle.id]: true },
          score: prev.score + potentialPoints,
          currentStreak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
        }));
        if (sprintActive) {
          setSprintScore((prev) => prev + potentialPoints);
        }
      }

      // Schedule the 3-second delayed popup prompting Next Puzzle
      setCompletedPuzzleSnapshot({
        title: currentPuzzle.title,
        answer: currentPuzzle.answer,
        pointsEarned: potentialPoints,
      });
    } else {
      soundEngine.playWrong();
      if (checkAlmostMatch(guessInput, currentPuzzle.answer)) {
        setFeedbackStatus('almost');
        setFeedbackMessage('Close! You have part of the phrase right—keep going.');
      } else {
        setFeedbackStatus('wrong');
        setFeedbackMessage('Not quite right. Inspect the placement, size, or count of the words!');
      }
    }
  };

  const handleUnlockHint = (tierNumber: number) => {
    if (tierNumber <= hintsUnlocked || isSolved || isRevealed) return;
    soundEngine.playHint();
    setProgress((prev) => ({
      ...prev,
      hintsUsedByPuzzle: {
        ...prev.hintsUsedByPuzzle,
        [currentPuzzle.id]: tierNumber,
      },
    }));
  };

  const handleRevealAnswer = () => {
    if (!confirmReveal) {
      setConfirmReveal(true);
      return;
    }
    soundEngine.playClick();
    setConfirmReveal(false);
    setFeedbackStatus('revealed');
    setFeedbackMessage('Solution revealed.');
    setGuessInput(currentPuzzle.answer);
    setProgress((prev) => ({
      ...prev,
      revealedIds: { ...prev.revealedIds, [currentPuzzle.id]: true },
      currentStreak: 0,
    }));
  };

  const handlePrevPuzzle = () => {
    setCompletedPuzzleSnapshot(null);
    setShowNextPuzzleModal(false);
    if (sprintActive) {
      if (sprintIndex > 0) setSprintIndex(sprintIndex - 1);
      return;
    }
    if (activeDeck.length === 0) return;
    const prevIdx = (currentDeckIndex - 1 + activeDeck.length) % activeDeck.length;
    setCurrentPuzzleId(activeDeck[prevIdx].id);
  };

  const handleNextPuzzle = () => {
    setCompletedPuzzleSnapshot(null);
    setShowNextPuzzleModal(false);
    if (sprintActive) {
      if (sprintIndex + 1 < sprintQueue.length) {
        setSprintIndex(sprintIndex + 1);
      } else {
        setSprintFinished(true);
      }
      return;
    }
    if (activeDeck.length === 0) return;
    const nextIdx = (currentDeckIndex + 1) % activeDeck.length;
    setCurrentPuzzleId(activeDeck[nextIdx].id);
  };

  const handleRandomUnsolved = () => {
    setCompletedPuzzleSnapshot(null);
    setShowNextPuzzleModal(false);
    const pool = activeDeck.filter((p) => !progress.solvedIds[p.id] && p.id !== currentPuzzle.id);
    const targetPool = pool.length > 0 ? pool : activeDeck;
    if (targetPool.length === 0) return;
    const randomPick = targetPool[Math.floor(Math.random() * targetPool.length)];
    setCurrentPuzzleId(randomPick.id);
  };

  const handleStartSprint = () => {
    const unsolvedPool = INDIVIDUAL_PUZZLES.filter((p) => !progress.solvedIds[p.id]);
    const sourcePool = unsolvedPool.length >= 5 ? unsolvedPool : INDIVIDUAL_PUZZLES;
    const shuffled = [...sourcePool].sort(() => Math.random() - 0.5).slice(0, 5);
    setSprintQueue(shuffled.map((p) => p.id));
    setSprintIndex(0);
    setSprintScore(0);
    setSprintSeconds(0);
    setSprintFinished(false);
    setSprintActive(true);
    setCompletedPuzzleSnapshot(null);
    setShowNextPuzzleModal(false);
    setActiveTab('play');
  };

  const handleExitSprint = () => {
    setSprintActive(false);
    setSprintFinished(false);
    setSprintQueue([]);
  };

  const handleWorksheetItemSolved = (itemKey: string, points: number) => {
    soundEngine.playSolve();
    setProgress((prev) => {
      if (prev.worksheetSolved[itemKey]) return prev;
      return {
        ...prev,
        worksheetSolved: { ...prev.worksheetSolved, [itemKey]: true },
        score: prev.score + points,
      };
    });
  };

  // Render masked answer slots for Hint Tier 1+
  const renderLetterSlots = () => {
    const words = currentPuzzle.answer.split(' ');
    const showFirstLetters = hintsUnlocked >= 2 || isSolved || isRevealed;
    const showVowels = hintsUnlocked >= 4 || isSolved || isRevealed;
    const showFull = isSolved || isRevealed;

    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-2 py-3 px-3 sm:px-4 bg-[var(--bg-subtle)] rounded-xl border-2 border-[var(--border-card)] shadow-2xs">
        {words.map((word, wIdx) => (
          <div key={wIdx} className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            {word.split('').map((char, cIdx) => {
              const isAlphaNum = /[a-zA-Z0-9]/.test(char);
              if (!isAlphaNum) {
                return (
                  <span key={cIdx} className="font-mono text-sm sm:text-base font-black text-stone-800 dark:text-amber-300 px-0.5">
                    {char}
                  </span>
                );
              }
              const isVowel = /[aeiouAEIOU]/.test(char);
              const shouldRevealChar =
                showFull || (showFirstLetters && cIdx === 0) || (showVowels && isVowel);

              return (
                <span
                  key={cIdx}
                  className={`w-6 h-7 sm:w-8 sm:h-9 rounded-lg flex items-center justify-center font-mono text-xs sm:text-base font-black transition-all ${
                    shouldRevealChar
                      ? 'bg-[var(--brand-primary)] text-amber-300 dark:bg-amber-400 dark:text-[#11081A] border-2 border-[var(--brand-gold)] dark:border-amber-200 shadow-md scale-105'
                      : 'bg-[var(--bg-card)] text-stone-900 dark:text-amber-300 border-2 border-stone-400 dark:border-amber-400/80 shadow-2xs'
                  }`}
                >
                  {shouldRevealChar ? char.toUpperCase() : '_'}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const totalSolvedCount = Object.keys(progress.solvedIds).length;
  const totalWorksheetSolvedCount = Object.keys(progress.worksheetSolved).length;
  const totalWorksheetItems = WORKSHEET_GRIDS.reduce(
    (acc, w) => acc + (w.items?.length || 0),
    0
  );

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-stone-900 dark:text-stone-100 selection:bg-amber-400/30 transition-colors duration-200 overflow-x-hidden">
      {/* Top Editorial Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-card)] transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          {/* Primary Row: Brand + Theme Controls + Sprint */}
          <div className="h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
            {/* Zone 1: Brand Wordmark + User 3D Logo Emblem */}
            <div className="flex items-center gap-2 min-w-0 shrink">
              <button
                onClick={() => {
                  handleExitSprint();
                  setActiveTab('play');
                }}
                className="text-left group flex items-center gap-2 min-w-0"
              >
                <img
                  src="/assets/aistudio/3d_logo_944e5372.png"
                  alt="The Missing Piece Logo"
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-contain shrink-0 drop-shadow-xs"
                />
                <span className="font-serif text-sm sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 group-hover:text-[var(--brand-text)] transition-colors truncate">
                  Puzzle a Day <span className="text-[var(--brand-gold)] font-normal">·</span> Rebus
                </span>
              </button>
            </div>

            {/* Zone 2: Desktop Center Navigation Links */}
            <nav className="hidden lg:flex items-center gap-5">
              <button
                onClick={() => {
                  handleExitSprint();
                  setActiveTab('play');
                }}
                className={`text-sm font-medium transition-colors py-1 ${
                  activeTab === 'play' && !sprintActive
                    ? 'text-[var(--brand-text)] font-semibold underline decoration-2 underline-offset-8 decoration-[var(--brand-gold)]'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Play ({INDIVIDUAL_PUZZLES.length})
              </button>
              <button
                onClick={() => {
                  handleExitSprint();
                  setActiveTab('archive');
                }}
                className={`text-sm font-medium transition-colors py-1 ${
                  activeTab === 'archive'
                    ? 'text-[var(--brand-text)] font-semibold underline decoration-2 underline-offset-8 decoration-[var(--brand-gold)]'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Archive ({INDIVIDUAL_PUZZLES.length})
              </button>
              <button
                onClick={() => {
                  handleExitSprint();
                  setActiveTab('worksheets');
                }}
                className={`text-sm font-medium transition-colors py-1 ${
                  activeTab === 'worksheets'
                    ? 'text-[var(--brand-text)] font-semibold underline decoration-2 underline-offset-8 decoration-[var(--brand-gold)]'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                PDFs & Sheets ({WORKSHEET_GRIDS.length})
              </button>
              <button
                onClick={() => {
                  handleExitSprint();
                  setActiveTab('rules');
                }}
                className={`text-sm font-medium transition-colors py-1 ${
                  activeTab === 'rules'
                    ? 'text-[var(--brand-text)] font-semibold underline decoration-2 underline-offset-8 decoration-[var(--brand-gold)]'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Rules & Stats
              </button>
            </nav>

            {/* Zone 3: Logo Theme Toggle + Dark Mode Selection Slider + Sprint CTA */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <div className="hidden xl:flex items-center gap-3 text-xs font-mono text-stone-600 dark:text-stone-400">
                <span title="Solved Main Game Puzzles">
                  Solved:{' '}
                  <strong className="text-stone-900 dark:text-stone-100">
                    {totalSolvedCount}/{INDIVIDUAL_PUZZLES.length}
                  </strong>
                </span>
                <span className="text-stone-300 dark:text-stone-700">·</span>
                <span className="flex items-center gap-1" title="Current Solve Streak">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <strong className="text-stone-900 dark:text-stone-100">{progress.currentStreak}</strong>
                </span>
              </div>

              {/* Brand Theme Toggle Button (Logo Colours Default vs Classic Emerald) */}
              <button
                onClick={() => setBrandTheme((prev) => (prev === 'logo' ? 'classic' : 'logo'))}
                title={
                  brandTheme === 'logo'
                    ? 'Active Theme: Logo Colours (Purple & Gold). Click for Classic Emerald.'
                    : 'Active Theme: Classic Emerald. Click for Logo Colours (Purple & Gold).'
                }
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-card)] text-xs font-medium text-stone-700 dark:text-stone-200 hover:border-[var(--brand-accent)] transition-colors cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-[var(--brand-text)] shrink-0" />
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                    brandTheme === 'logo'
                      ? 'bg-[#4A1259] border-[#EAB308] ring-1 ring-[#EAB308]/60'
                      : 'bg-[#0F5132] border-emerald-400'
                  }`}
                />
                <span className="hidden sm:inline text-[11px] font-semibold">
                  {brandTheme === 'logo' ? 'Logo Theme' : 'Classic'}
                </span>
              </button>

              {/* Dark Mode Selection Slider in Top Bar */}
              <div
                onClick={() => setDarkMode(!darkMode)}
                role="switch"
                aria-checked={darkMode}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDarkMode(!darkMode);
                  }
                }}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-card)] cursor-pointer select-none transition-colors"
              >
                <Sun
                  className={`w-3.5 h-3.5 transition-colors ${
                    !darkMode ? 'text-amber-500' : 'text-stone-400 dark:text-stone-500'
                  }`}
                />
                <div className="relative w-7 sm:w-8 h-4 rounded-full bg-stone-300 dark:bg-[var(--brand-primary)] transition-colors">
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      darkMode ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <Moon
                  className={`w-3.5 h-3.5 transition-colors ${
                    darkMode ? 'text-[var(--brand-gold)]' : 'text-stone-400'
                  }`}
                />
              </div>

              {/* Stream Mode Toggle Button */}
              <button
                onClick={() => setStreamMode((prev) => !prev)}
                title={streamMode ? 'Exit Stream Mode' : 'Enter Stream Mode (Full Screen Focused View)'}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  streamMode
                    ? 'bg-purple-800 text-amber-300 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                    : 'bg-[var(--bg-subtle)] border-[var(--border-card)] text-stone-800 dark:text-stone-200 hover:border-[var(--brand-accent)]'
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Stream Mode</span>
              </button>

              {sprintActive ? (
                <button
                  onClick={handleExitSprint}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>Exit ({sprintIndex + 1}/5)</span>
                </button>
              ) : (
                <button
                  onClick={handleStartSprint}
                  className="px-2 sm:px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-medium hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center gap-1 shadow-2xs shrink-0"
                >
                  <Timer className="w-3.5 h-3.5 text-[var(--brand-gold)]" />
                  <span>5-Round Sprint</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile & Tablet Sub-nav Row */}
          <div className="flex lg:hidden items-center justify-between border-t border-[var(--border-card)] py-1.5 gap-1">
            <button
              onClick={() => {
                handleExitSprint();
                setActiveTab('play');
              }}
              className={`flex-1 text-center text-[11px] sm:text-xs font-medium py-1 rounded transition-colors ${
                activeTab === 'play' && !sprintActive
                  ? 'text-[var(--brand-text)] font-bold bg-[var(--brand-soft-bg)]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              Play ({INDIVIDUAL_PUZZLES.length})
            </button>
            <button
              onClick={() => {
                handleExitSprint();
                setActiveTab('archive');
              }}
              className={`flex-1 text-center text-[11px] sm:text-xs font-medium py-1 rounded transition-colors ${
                activeTab === 'archive'
                  ? 'text-[var(--brand-text)] font-bold bg-[var(--brand-soft-bg)]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              Archive ({INDIVIDUAL_PUZZLES.length})
            </button>
            <button
              onClick={() => {
                handleExitSprint();
                setActiveTab('worksheets');
              }}
              className={`flex-1 text-center text-[11px] sm:text-xs font-medium py-1 rounded transition-colors ${
                activeTab === 'worksheets'
                  ? 'text-[var(--brand-text)] font-bold bg-[var(--brand-soft-bg)]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              PDFs ({WORKSHEET_GRIDS.length})
            </button>
            <button
              onClick={() => {
                handleExitSprint();
                setActiveTab('rules');
              }}
              className={`flex-1 text-center text-[11px] sm:text-xs font-medium py-1 rounded transition-colors ${
                activeTab === 'rules'
                  ? 'text-[var(--brand-text)] font-bold bg-[var(--brand-soft-bg)]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              Rules & Stats
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* VIEW 1: PLAY MODE */}
        {activeTab === 'play' && (
          <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-4 sm:space-y-6">
            {/* Sprint Mode Banner or Summary */}
            {sprintActive && (
              <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm">
                    {sprintIndex + 1}/5
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                      5-Round Rebus Sprint
                    </h2>
                    <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300/80">
                      Decode 5 random rebuses as quickly as you can!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs sm:text-sm">
                  <div className="text-amber-950 dark:text-amber-200">
                    Time: <strong>{formatTime(sprintSeconds)}</strong>
                  </div>
                  <div className="text-amber-950 dark:text-amber-200">
                    Sprint Score: <strong>{sprintScore}</strong>
                  </div>
                </div>
              </div>
            )}

            {sprintFinished ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft-bg)] text-[var(--brand-text)] flex items-center justify-center mx-auto">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                    5-Round Sprint Complete!
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                    You completed the 5-puzzle sprint in{' '}
                    <strong className="font-mono">{formatTime(sprintSeconds)}</strong> with{' '}
                    <strong className="font-mono">{sprintScore} points</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={handleStartSprint}
                    className="px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
                  >
                    Play Another Sprint
                  </button>
                  <button
                    onClick={handleExitSprint}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bg-subtle)] text-stone-700 dark:text-stone-200 text-sm font-medium hover:opacity-90 transition-colors"
                  >
                    Return to Standard Play
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Deck Controls & Navigation Bar */}
                {!sprintActive && (
                  <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 shadow-2xs">
                    {/* Row 1: Category Deck + Puzzle Jump + Filter Unsolved */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5 flex items-center gap-2">
                        <label
                          htmlFor="category-select"
                          className="text-xs font-medium text-stone-500 dark:text-stone-400 shrink-0"
                        >
                          Deck:
                        </label>
                        <select
                          id="category-select"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[var(--brand-accent)] truncate"
                        >
                          <option value="All">All Main Game Puzzles ({INDIVIDUAL_PUZZLES.length})</option>
                          {PUZZLE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4 flex items-center gap-2">
                        <select
                          aria-label="Select specific puzzle"
                          value={currentPuzzle.id}
                          onChange={(e) => {
                            setCompletedPuzzleSnapshot(null);
                            setShowNextPuzzleModal(false);
                            setCurrentPuzzleId(e.target.value);
                          }}
                          className="w-full text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[var(--brand-accent)] truncate"
                        >
                          {activeDeck.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} {progress.solvedIds[p.id] ? '✓' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex items-center justify-end">
                        <button
                          onClick={() => setUnsolvedOnly(!unsolvedOnly)}
                          className={`w-full sm:w-auto text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
                            unsolvedOnly
                              ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                              : 'bg-[var(--bg-subtle)] text-stone-600 dark:text-stone-300 border-[var(--border-card)] hover:opacity-90'
                          }`}
                        >
                          {unsolvedOnly ? 'Unsolved Only ✓' : 'Filter Unsolved'}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Prev / Random / Next + Sound (Favourites button removed as requested) */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-card)]">
                      <span className="font-mono text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">
                        <strong className="text-stone-800 dark:text-stone-200">
                          {currentDeckIndex + 1}
                        </strong>{' '}
                        / {activeDeck.length}
                      </span>

                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          onClick={handlePrevPuzzle}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:opacity-85 text-stone-700 dark:text-stone-200 text-xs font-medium flex items-center gap-0.5 transition-colors border border-[var(--border-card)]"
                          title="Previous Puzzle"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <button
                          onClick={handleRandomUnsolved}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:opacity-85 text-stone-700 dark:text-stone-200 text-xs font-medium flex items-center gap-1 transition-colors border border-[var(--border-card)]"
                          title="Jump to Random Unsolved Puzzle"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>Random</span>
                        </button>
                        <button
                          onClick={handleNextPuzzle}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:opacity-85 text-stone-700 dark:text-stone-200 text-xs font-medium flex items-center gap-0.5 transition-colors border border-[var(--border-card)]"
                          title="Next Puzzle"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          className="p-1.5 rounded-lg bg-[var(--bg-subtle)] text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 border border-[var(--border-card)] transition-colors"
                          title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                        >
                          {soundEnabled ? (
                            <Volume2 className="w-3.5 h-3.5" />
                          ) : (
                            <VolumeX className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compact Inline Metadata Line */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-stone-500 dark:text-stone-400">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {currentPuzzle.title}
                    </span>
                    <span>·</span>
                    <span>{currentPuzzle.category}</span>
                    <span>·</span>
                    <span
                      className={`font-medium ${
                        currentPuzzle.difficulty === 'Challenging'
                          ? 'text-red-700 dark:text-red-400'
                          : currentPuzzle.difficulty === 'Medium'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-[var(--brand-text)]'
                      }`}
                    >
                      Difficulty: {currentPuzzle.difficulty}
                    </span>
                    <span>·</span>
                    <span className="font-mono">Reward: {potentialPoints} pts</span>
                  </div>

                  {isSolved && (
                    <span className="inline-flex items-center gap-1 text-[var(--brand-text)] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Solved
                    </span>
                  )}
                </div>

                {/* Focal Point: Rebus Visual Stage */}
                <RebusVisualStage puzzle={currentPuzzle} isSolved={isSolved} />

                {/* Interactive Answer & Hint Console */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-3.5 sm:p-6 shadow-xs space-y-4 sm:space-y-5 transition-colors">
                  {/* Word & Letter Pattern Bar */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs sm:text-sm">
                      <span className="font-bold text-stone-900 dark:text-stone-100">{currentPuzzle.prompt}</span>
                      <span className="font-mono text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Lengths: ({currentPuzzle.answer.split(' ').map((w) => w.length).join(', ')})
                      </span>
                    </div>
                    {renderLetterSlots()}
                  </div>

                  {/* Answer Submission Form */}
                  <form onSubmit={handleGuessSubmit} className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={guessInput}
                      onChange={(e) => {
                        setGuessInput(e.target.value);
                        if (feedbackStatus === 'wrong' || feedbackStatus === 'almost') {
                          setFeedbackStatus('idle');
                        }
                      }}
                      disabled={isSolved || isRevealed}
                      placeholder={
                        isSolved || isRevealed
                          ? currentPuzzle.answer
                          : 'Type your decoded phrase or word...'
                      }
                      className={`flex-1 px-3.5 sm:px-4 py-3 rounded-xl text-sm sm:text-base font-medium transition-all focus:outline-none ${
                        feedbackStatus === 'correct'
                          ? 'bg-[var(--brand-soft-bg)] border-2 border-[var(--brand-primary)] text-[var(--brand-text)] font-bold'
                          : feedbackStatus === 'wrong'
                          ? 'bg-red-50/60 dark:bg-red-950/30 border-2 border-red-600 text-stone-900 dark:text-stone-100'
                          : feedbackStatus === 'almost'
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-500 text-stone-900 dark:text-stone-100'
                          : 'bg-[var(--bg-subtle)] border border-[var(--border-card)] text-stone-900 dark:text-stone-100 focus:bg-[var(--bg-card)] focus:border-[var(--brand-accent)]'
                      }`}
                    />

                    {!isSolved && !isRevealed ? (
                      <button
                        type="submit"
                        className="px-5 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors shadow-2xs cursor-pointer shrink-0"
                      >
                        Check Answer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNextPuzzle}
                        className="px-5 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                      >
                        <span>{sprintActive ? 'Next Sprint Puzzle' : 'Next Puzzle'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </form>

                  {/* Feedback Banner & Explanation */}
                  {feedbackStatus !== 'idle' && (
                    <div
                      className={`p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm space-y-1.5 ${
                        feedbackStatus === 'correct'
                          ? 'bg-[var(--brand-soft-bg)] border-[var(--brand-soft-border)] text-stone-900 dark:text-stone-100'
                          : feedbackStatus === 'almost'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                          : feedbackStatus === 'revealed'
                          ? 'bg-[var(--bg-subtle)] border-[var(--border-card)] text-stone-800 dark:text-stone-200'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold flex items-center gap-1.5">
                          {feedbackStatus === 'correct' && (
                            <Sparkles className="w-4 h-4 text-[var(--brand-gold)] shrink-0" />
                          )}
                          {feedbackMessage}
                        </span>
                        {(isSolved || isRevealed) && (
                          <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-card)]">
                            {currentPuzzle.answer}
                          </span>
                        )}
                      </div>

                      {(isSolved || isRevealed) && (
                        <p className="text-xs leading-relaxed opacity-90 pt-1">
                          <strong>Clue Breakdown:</strong> {currentPuzzle.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 4-Tier Progressive Hint System + Reveal Action */}
                  <div className="pt-3 border-t border-[var(--border-card)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Progressive Hint System</span>
                        <span className="text-stone-600 dark:text-stone-400 font-semibold">
                          ({hintsUnlocked}/4 unlocked · -15 pts each)
                        </span>
                      </div>

                      {!isSolved && !isRevealed && (
                        <button
                          type="button"
                          onClick={handleRevealAnswer}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                            confirmReveal
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-[var(--bg-subtle)] text-stone-800 dark:text-stone-200 border-[var(--border-card)] hover:opacity-85'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{confirmReveal ? 'Confirm Reveal?' : 'Reveal Answer'}</span>
                        </button>
                      )}
                    </div>

                    {/* 4 Hint Pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {hintTiers.map((tier) => {
                        const isUnlocked = hintsUnlocked >= tier.tier || isSolved || isRevealed;
                        const isNextToUnlock = tier.tier === hintsUnlocked + 1 && !isSolved && !isRevealed;

                        return (
                          <div
                            key={tier.tier}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                              isUnlocked
                                ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-stone-950 dark:text-stone-100 shadow-2xs'
                                : isNextToUnlock
                                ? 'bg-[var(--bg-subtle)] border-amber-400/80 hover:border-amber-500 cursor-pointer text-stone-900 dark:text-stone-100'
                                : 'bg-[var(--bg-subtle)] border-[var(--border-card)] opacity-75 text-stone-700 dark:text-stone-300'
                            }`}
                            onClick={() => {
                              if (isNextToUnlock) handleUnlockHint(tier.tier);
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300">
                                Hint {tier.tier}: {tier.label}
                              </span>
                              {!isUnlocked && (
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/90 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                  {isNextToUnlock ? 'Tap to Unlock (-15 pts)' : 'Locked'}
                                </span>
                              )}
                            </div>

                            {isUnlocked ? (
                              <p className="text-xs sm:text-sm text-stone-950 dark:text-stone-100 leading-relaxed font-semibold">
                                {tier.content}
                              </p>
                            ) : (
                              <p className="text-xs text-stone-700 dark:text-stone-300 font-medium italic">
                                {isNextToUnlock
                                  ? 'Click to reveal this clue tier...'
                                  : `Unlock Hint ${tier.tier - 1} first`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW 2: ARCHIVE BROWSER */}
        {activeTab === 'archive' && (
          <ArchiveBrowserView
            puzzles={INDIVIDUAL_PUZZLES}
            solvedIds={progress.solvedIds}
            revealedIds={progress.revealedIds}
            onSelectPuzzle={(puzzleId) => {
              setSelectedCategory('All');
              setUnsolvedOnly(false);
              setCurrentPuzzleId(puzzleId);
              setActiveTab('play');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 3: WORKSHEETS */}
        {activeTab === 'worksheets' && (
          <WorksheetSolverView
            solvedWorksheetItems={progress.worksheetSolved}
            onMarkWorksheetItemSolved={handleWorksheetItemSolved}
          />
        )}

        {/* VIEW 4: RULES & STATS */}
        {activeTab === 'rules' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Player Stats Summary Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
                  Your Rebus Record
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowIntroScreen(true)}
                    className="text-xs text-[var(--brand-text)] font-bold hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Replay Intro Video</span>
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem(STORAGE_KEY);
                      setProgress(INITIAL_PROGRESS);
                    }}
                    className="text-xs text-stone-500 dark:text-stone-400 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Progress</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Main Game Solved</div>
                  <div className="font-mono text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {totalSolvedCount} / {INDIVIDUAL_PUZZLES.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400">PDF Sheet Items</div>
                  <div className="font-mono text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {totalWorksheetSolvedCount} / {totalWorksheetItems}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Best Streak</div>
                  <div className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {progress.bestStreak}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Total Score</div>
                  <div className="font-mono text-xl font-bold text-[var(--brand-text)] mt-0.5">
                    {progress.score} pts
                  </div>
                </div>
              </div>
            </div>

            {/* How to Decode a Rebus Guide */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
                How to Decode a Rebus Puzzle
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                A rebus is a visual word puzzle that uses typography, spatial positioning, color,
                quantity, and direction to represent a familiar idiom, saying, or compound word.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    1. Spatial Position
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Look at where words sit relative to each other: <em>over</em>, <em>under</em>,{' '}
                    <em>inside</em>, <em>beside</em>, or <em>between</em>. For example, "MIND"
                    placed above "MATTER" reads as <strong>Mind Over Matter</strong>.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    2. Direction & Orientation
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Words spelled backward, vertically, upside-down, or diagonally give directional
                    clues. "enohp" spelled backward is <strong>Backwards Glance / Phone</strong>.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    3. Number & Repetition
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Count how many times a word or letter appears. Four "WHEEL"s below a "CAR" or
                    "ONCE" repeated four times signals a number in the phrase.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    4. Color, Size & Emphasis
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Notice if a word is tinted red, green, blue, tiny, or giant. A tiny "WORLD"
                    means <strong>It's a Small World</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-card)] flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span>
                  Puzzles curated from the{' '}
                  <strong className="text-stone-700 dark:text-stone-200">
                    Puzzle a Day WordPress Rebus Archive
                  </strong>{' '}
                  &amp;{' '}
                  <strong className="text-stone-700 dark:text-stone-200">
                    Just Family Fun 2025 Printable Collection
                  </strong>
                  .
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href="https://puzzleaday.wordpress.com/category/rebus/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--brand-text)] font-medium hover:underline"
                  >
                    <span>Puzzle a Day</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://justfamilyfun.com/100-printable-rebus-puzzles-with-answers-2025/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--brand-text)] font-medium hover:underline"
                  >
                    <span>Just Family Fun PDFs</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3-Second Delayed Next Puzzle Completion Popup Modal */}
      {showNextPuzzleModal && completedPuzzleSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowNextPuzzleModal(false)}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-5 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowNextPuzzleModal(false)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-[var(--bg-subtle)] transition-colors"
              title="Close popup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft-bg)] text-[var(--brand-text)] flex items-center justify-center mx-auto shadow-2xs">
              <Sparkles className="w-6 h-6 text-[var(--brand-gold)]" />
            </div>

            <div className="space-y-1.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--brand-text)]">
                Puzzle Completed · +{completedPuzzleSnapshot.pointsEarned} Pts
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                Ready for the Next Challenge?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                You solved <strong>{completedPuzzleSnapshot.title}</strong>:
              </p>
              <div className="inline-block mt-1 px-3 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-card)] font-mono text-xs font-bold text-stone-800 dark:text-stone-200">
                {completedPuzzleSnapshot.answer}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  if (activeTab !== 'play') {
                    setActiveTab('play');
                  }
                  handleNextPuzzle();
                }}
                className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Next Puzzle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNextPuzzleModal(false)}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[var(--bg-subtle)] text-stone-600 dark:text-stone-300 font-medium text-sm hover:opacity-85 transition-colors cursor-pointer"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Load Intro Video Screen */}
      {showIntroScreen && (
        <div className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-300">
          <div className="relative max-w-3xl w-full bg-stone-900 border-2 border-purple-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center">
            {/* Header Bar */}
            <div className="w-full bg-stone-950/90 px-4 py-3 border-b border-purple-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/3d_logo_944e5372.png"
                  alt="The Missing Piece Logo"
                  className="w-7 h-7 rounded-full object-contain shrink-0"
                />
                <span className="font-serif text-sm sm:text-base font-bold text-amber-300 truncate">
                  The Missing Piece · Rebus Challenge
                </span>
              </div>
              <button
                onClick={() => setShowIntroScreen(false)}
                className="text-xs font-semibold text-stone-400 hover:text-white px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-800 border border-stone-700 transition-colors shrink-0 cursor-pointer"
              >
                Skip Intro
              </button>
            </div>

            {/* Video Box */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={introVideoRef}
                src="/assets/aistudio/gemini_generated_video_cbfa0c87_3880c18e.mp4"
                autoPlay
                playsInline
                muted={introMuted}
                onEnded={() => setIntroVideoFinished(true)}
                onTimeUpdate={(e) => {
                  if (e.currentTarget.currentTime >= 12) {
                    setIntroVideoFinished(true);
                  }
                }}
                className="w-full h-full object-cover"
              />

              {/* Mute/Unmute Toggle */}
              <button
                onClick={() => setIntroMuted((prev) => !prev)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-stone-900/80 text-amber-300 hover:bg-stone-900 border border-amber-500/40 transition-colors cursor-pointer"
                title={introMuted ? 'Unmute video sound' : 'Mute video sound'}
              >
                {introMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Start Game CTA Overlay (appears after 11 seconds or when video finishes) */}
              {introVideoFinished && (
                <div className="absolute inset-0 bg-stone-950/65 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500 z-20">
                  <button
                    onClick={() => setShowIntroScreen(false)}
                    className="px-8 py-4 sm:px-10 sm:py-5 rounded-2xl bg-gradient-to-r from-purple-800 via-purple-700 to-amber-500 hover:from-purple-700 hover:to-amber-400 text-white font-serif text-xl sm:text-3xl font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-3 border-2 border-amber-300 cursor-pointer"
                  >
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-amber-300 fill-amber-300 shrink-0" />
                    <span>Start Game</span>
                  </button>
                  <p className="text-amber-200/90 font-medium text-xs sm:text-sm mt-3.5 tracking-wide drop-shadow-md">
                    Click to open the main rebus puzzle game
                  </p>
                </div>
              )}
            </div>

            {/* Subtitle / Progress Footer */}
            <div className="w-full bg-stone-950 px-4 py-2.5 flex items-center justify-between text-xs text-stone-400 border-t border-stone-800">
              <span className="font-mono text-[11px] text-purple-300">
                {introVideoFinished ? 'Intro Video Finished' : 'Playing Intro Video (12s)...'}
              </span>
              {!introVideoFinished && (
                <button
                  onClick={() => setIntroVideoFinished(true)}
                  className="text-amber-400 hover:text-amber-300 underline font-medium text-[11px] cursor-pointer"
                >
                  Show Start Button Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stream Mode Full-Screen View */}
      {streamMode && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-canvas)] flex flex-col justify-between p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {/* Stream Mode Top Bar */}
          <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 bg-[var(--bg-card)] border-2 border-[var(--border-card)] rounded-2xl px-4 py-3 shadow-md shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-mono font-bold tracking-wider uppercase shrink-0">
                STREAM MODE
              </span>
              <h2 className="font-serif text-sm sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
                {currentPuzzle.title}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handlePrevPuzzle}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-stone-800 dark:text-stone-200 text-xs font-semibold border border-[var(--border-card)] flex items-center gap-1 hover:opacity-85 cursor-pointer"
                title="Previous Puzzle"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Prev</span>
              </button>
              <button
                onClick={handleRandomUnsolved}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-stone-800 dark:text-stone-200 text-xs font-semibold border border-[var(--border-card)] flex items-center gap-1 hover:opacity-85 cursor-pointer"
                title="Random Unsolved Puzzle"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Random</span>
              </button>
              <button
                onClick={handleNextPuzzle}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-stone-800 dark:text-stone-200 text-xs font-semibold border border-[var(--border-card)] flex items-center gap-1 hover:opacity-85 cursor-pointer"
                title="Next Puzzle"
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setStreamMode(false)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                title="Exit Stream Mode"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Stream</span>
              </button>
            </div>
          </div>

          {/* Stream Center Area: Fill-Screen Rebus Visual Stage */}
          <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center my-1.5 sm:my-2">
            <div className="w-full h-full flex flex-col justify-center">
              <RebusVisualStage puzzle={currentPuzzle} isSolved={isSolved} hideFooter={true} isStreamMode={true} />
            </div>
          </div>

          {/* Stream Bottom Area: Letter Slots & Answer Entry Form */}
          <div className="w-full max-w-4xl mx-auto bg-[var(--bg-card)] border-2 border-[var(--border-card)] rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-3 shrink-0 mt-1 sm:mt-1.5">
            {renderLetterSlots()}

            {/* Answer Form */}
            <form onSubmit={handleGuessSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={guessInput}
                onChange={(e) => {
                  setGuessInput(e.target.value);
                  if (feedbackStatus === 'wrong' || feedbackStatus === 'almost') {
                    setFeedbackStatus('idle');
                  }
                }}
                disabled={isSolved || isRevealed}
                placeholder={
                  isSolved || isRevealed
                    ? currentPuzzle.answer
                    : 'Type your decoded phrase or word...'
                }
                className={`flex-1 px-4 py-3.5 rounded-xl text-base sm:text-lg font-bold transition-all focus:outline-none ${
                  feedbackStatus === 'correct'
                    ? 'bg-[var(--brand-soft-bg)] border-2 border-[var(--brand-primary)] text-[var(--brand-text)]'
                    : feedbackStatus === 'wrong'
                    ? 'bg-red-50/60 dark:bg-red-950/30 border-2 border-red-600 text-stone-900 dark:text-stone-100'
                    : 'bg-[var(--bg-subtle)] border-2 border-[var(--border-card)] text-stone-900 dark:text-stone-100 focus:border-[var(--brand-accent)]'
                }`}
              />

              {!isSolved && !isRevealed ? (
                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-base hover:bg-[var(--brand-primary-hover)] transition-colors shadow-md cursor-pointer shrink-0"
                >
                  Check Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextPuzzle}
                  className="px-6 py-3.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-base hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
                >
                  <span>Next Rebus</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </form>

            {/* Feedback Message in Stream Mode */}
            {feedbackStatus !== 'idle' && (
              <div
                className={`p-3.5 rounded-xl border text-sm font-bold flex items-center justify-between gap-2 ${
                  feedbackStatus === 'correct'
                    ? 'bg-[var(--brand-soft-bg)] border-[var(--brand-soft-border)] text-stone-900 dark:text-stone-100'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}
              >
                <span>{feedbackMessage}</span>
                {(isSolved || isRevealed) && (
                  <span className="font-mono text-xs uppercase px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-card)] font-bold">
                    {currentPuzzle.answer}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
