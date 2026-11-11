import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Eye,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  FileDown,
  BookOpen,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  WORKSHEET_GRIDS,
  PDF_LIBRARY,
  WorksheetGrid,
  WorksheetGridItem,
} from '../data/rebusData';
import { checkAnswerMatch } from '../utils/matcher';
import { soundEngine } from '../utils/sound';

interface WorksheetSolverViewProps {
  solvedWorksheetItems: Record<string, boolean>;
  onMarkWorksheetItemSolved: (itemKey: string, points: number) => void;
}

const COLLECTION_FILTERS = [
  { id: 'ALL', label: 'All Sheets & PDFs (53)' },
  { id: 'JFF: Themed PDF Packs', label: 'JFF: 7 Themed PDF Packs' },
  { id: 'JFF: 100 Easy Rebus PDFs', label: 'JFF: 100 Easy PDFs (9)' },
  { id: 'JFF: 100 Sayings Rebus PDFs', label: 'JFF: 100 Sayings PDFs (9)' },
  { id: 'JFF: 144 Great Quest PDFs', label: 'JFF: 144 Quest PDFs (12)' },
  { id: 'Puzzle a Day Grids', label: 'Puzzle a Day Grids (16)' },
];

export const WorksheetSolverView: React.FC<WorksheetSolverViewProps> = ({
  solvedWorksheetItems,
  onMarkWorksheetItemSolved,
}) => {
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [selectedSheetId, setSelectedSheetId] = useState<string>(WORKSHEET_GRIDS[0]?.id || '');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealedClues, setRevealedClues] = useState<Record<string, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [zoomSheet, setZoomSheet] = useState<boolean>(false);
  const [showPdfVault, setShowPdfVault] = useState<boolean>(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 3-Second Post-Completion Next Puzzle Popup State for Worksheet Items
  const [completionModal, setCompletionModal] = useState<{
    status: 'idle' | 'counting' | 'open';
    sheetId: string;
    itemIndex: number;
    answer: string;
    explanation: string;
    outcome: 'solved' | 'revealed';
    pointsEarned: number;
    secondsLeft: number;
  }>({
    status: 'idle',
    sheetId: '',
    itemIndex: 0,
    answer: '',
    explanation: '',
    outcome: 'solved',
    pointsEarned: 0,
    secondsLeft: 3,
  });

  const filteredSheets = useMemo(() => {
    if (collectionFilter === 'ALL') return WORKSHEET_GRIDS;
    return WORKSHEET_GRIDS.filter((g) => g.collection === collectionFilter);
  }, [collectionFilter]);

  const activeSheet: WorksheetGrid = useMemo(() => {
    return (
      filteredSheets.find((g) => g.id === selectedSheetId) ||
      filteredSheets[0] ||
      WORKSHEET_GRIDS[0]
    );
  }, [filteredSheets, selectedSheetId]);

  useEffect(() => {
    if (completionModal.status !== 'counting') return;

    const timer = window.setInterval(() => {
      setCompletionModal((prev) => {
        if (prev.status !== 'counting') return prev;
        if (prev.secondsLeft <= 1) {
          return { ...prev, status: 'open', secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [completionModal.status]);

  useEffect(() => {
    setCompletionModal((prev) =>
      prev.status === 'idle' ? prev : { ...prev, status: 'idle', secondsLeft: 3 }
    );
  }, [activeSheet.id]);

  const handleCheckItem = (sheet: WorksheetGrid, item: WorksheetGridItem) => {
    const key = `${sheet.id}-${item.index}`;
    const guess = inputs[key] || '';
    if (!guess.trim()) return;

    const matched = checkAnswerMatch(guess, {
      answer: item.answer,
      acceptedAnswers: item.acceptedAnswers?.length ? item.acceptedAnswers : [item.answer],
    });

    if (matched) {
      soundEngine.playSolve();
      const pts = revealedClues[key] ? 35 : 50;
      onMarkWorksheetItemSolved(key, pts);
      setCompletionModal({
        status: 'counting',
        sheetId: sheet.id,
        itemIndex: item.index,
        answer: item.answer,
        explanation: item.explanation,
        outcome: 'solved',
        pointsEarned: pts,
        secondsLeft: 3,
      });
    } else {
      soundEngine.playWrong();
      setWrongKey(key);
      setTimeout(() => setWrongKey(null), 300);
    }
  };

  const handleToggleClue = (key: string) => {
    soundEngine.playHint();
    setRevealedClues((prev) => ({ ...prev, [key]: true }));
  };

  const handleRevealItemAnswer = (sheet: WorksheetGrid, item: WorksheetGridItem) => {
    const key = `${sheet.id}-${item.index}`;
    soundEngine.playClick();
    setRevealedAnswers((prev) => ({ ...prev, [key]: true }));
    setInputs((prev) => ({ ...prev, [key]: item.answer }));
    setCompletionModal({
      status: 'counting',
      sheetId: sheet.id,
      itemIndex: item.index,
      answer: item.answer,
      explanation: item.explanation,
      outcome: 'revealed',
      pointsEarned: 0,
      secondsLeft: 3,
    });
  };

  const handleJumpToNextUnsolvedItem = () => {
    soundEngine.playClick();
    const currentPos = activeSheet.items.findIndex(
      (i) => i.index === completionModal.itemIndex
    );
    setCompletionModal((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }));

    for (let offset = 1; offset <= activeSheet.items.length; offset++) {
      const candidate =
        activeSheet.items[(currentPos + offset) % activeSheet.items.length];
      const candidateKey = `${activeSheet.id}-${candidate.index}`;
      if (!solvedWorksheetItems[candidateKey] && !revealedAnswers[candidateKey]) {
        const el = inputRefs.current[candidateKey];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          window.setTimeout(() => el.focus(), 150);
        }
        return;
      }
    }

    const sheetIdx = filteredSheets.findIndex((s) => s.id === activeSheet.id);
    if (sheetIdx >= 0 && filteredSheets.length > 1) {
      const nextSheet = filteredSheets[(sheetIdx + 1) % filteredSheets.length];
      setSelectedSheetId(nextSheet.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const solvedCountForSheet = activeSheet.items.filter(
    (item) => solvedWorksheetItems[`${activeSheet.id}-${item.index}`]
  ).length;

  const totalWorksheetPuzzles = useMemo(
    () => WORKSHEET_GRIDS.reduce((acc, s) => acc + s.totalCount, 0),
    []
  );

  return (
    <div className="space-y-6">
      {/* Worksheet & Printable PDF Header Panel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-stone-500 dark:text-zinc-400">
              <span>Multi-Puzzle Worksheets & Printable PDF Packs</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="tabular-nums">{WORKSHEET_GRIDS.length} Printable Sets</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="tabular-nums">{totalWorksheetPuzzles} Sheet Sub-Puzzles</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-100">
              {activeSheet.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setShowPdfVault((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showPdfVault
                  ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                  : 'bg-[var(--bg-subtle)] text-stone-800 dark:text-zinc-200 border-[var(--border-card)] hover:opacity-90'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {showPdfVault ? 'Hide Printable PDF Vault (36)' : 'Printable PDF Vault (36 PDFs)'}
              </span>
            </button>

            {activeSheet.pdfUrls?.map((pdf) => (
              <a
                key={pdf.url}
                href={pdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{pdf.label}</span>
              </a>
            ))}

            <a
              href={activeSheet.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-[var(--bg-subtle)] border border-[var(--border-card)] hover:opacity-90 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Source Article</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Collection Filter Segmented Row + Worksheet Dropdown */}
        <div className="pt-3 border-t border-[var(--border-card)] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {COLLECTION_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCollectionFilter(tab.id);
                  const nextList =
                    tab.id === 'ALL'
                      ? WORKSHEET_GRIDS
                      : WORKSHEET_GRIDS.filter((g) => g.collection === tab.id);
                  if (nextList[0]) {
                    setSelectedSheetId(nextList[0].id);
                  }
                  setZoomSheet(false);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  collectionFilter === tab.id
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-[var(--bg-subtle)] text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 w-full xl:w-auto">
            <label
              htmlFor="worksheet-select"
              className="text-xs font-medium text-stone-600 dark:text-zinc-400 whitespace-nowrap shrink-0"
            >
              Sheet ({filteredSheets.length}):
            </label>
            <select
              id="worksheet-select"
              value={activeSheet.id}
              onChange={(e) => {
                setSelectedSheetId(e.target.value);
                setZoomSheet(false);
              }}
              className="flex-1 sm:w-auto min-w-0 h-9 px-3 py-1 text-xs font-medium leading-normal bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              {filteredSheets.map((sheet) => {
                const done = sheet.items.filter(
                  (i) => solvedWorksheetItems[`${sheet.id}-${i.index}`]
                ).length;
                return (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.title} — {done}/{sheet.totalCount} Solved
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Collapsible Printable PDF Vault (All 36 Just Family Fun PDFs + 500-Puzzle Ebook) */}
      {showPdfVault && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-card)] pb-4">
            <div>
              <div className="text-xs text-stone-500 dark:text-zinc-400">
                Complete Just Family Fun Printable PDF Index (36 Downloadable PDFs)
              </div>
              <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                Printable Rebus PDF Library & Master Ebook
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPdfVault(false)}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
              aria-label="Close PDF Vault"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5">
            {PDF_LIBRARY.map((group) => (
              <div key={group.group} className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                  {group.group}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((pdfItem) => (
                    <div
                      key={pdfItem.url + pdfItem.title}
                      className="p-3.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-subtle)] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                          {pdfItem.count}
                        </div>
                        <div className="text-sm font-semibold text-stone-900 dark:text-zinc-100 leading-snug">
                          {pdfItem.title}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {pdfItem.worksheetId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCollectionFilter('ALL');
                              setSelectedSheetId(pdfItem.worksheetId!);
                              setShowPdfVault(false);
                            }}
                            className="text-xs font-semibold text-[var(--brand-text)] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            Open Interactive Sheet →
                          </button>
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-zinc-400">
                            Master Printable Ebook
                          </span>
                        )}

                        <a
                          href={pdfItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-800 dark:text-zinc-200 bg-[var(--bg-card)] border border-[var(--border-card)] hover:opacity-90 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          <FileDown className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split View: Left = Worksheet Image(s), Right = Interactive Numbered Solver */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Zoomable Sheet Graphic */}
        <div className="lg:col-span-6 lg:sticky lg:top-6 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-card)] bg-[var(--bg-subtle)] flex items-center justify-between text-xs text-stone-600 dark:text-zinc-400">
            <span className="font-mono tabular-nums">
              Progress: {solvedCountForSheet} / {activeSheet.totalCount} Solved ·{' '}
              {activeSheet.imageUrls.length}{' '}
              {activeSheet.imageUrls.length === 1 ? 'Page' : 'Pages'}
            </span>
            <button
              type="button"
              onClick={() => setZoomSheet((prev) => !prev)}
              className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0"
            >
              {zoomSheet ? (
                <>
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span>Fit to Panel</span>
                </>
              ) : (
                <>
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Zoom Sheet</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 sm:p-6 max-h-[75vh] overflow-auto flex flex-col items-center gap-4 bg-[var(--bg-subtle)]">
            {activeSheet.imageUrls.map((url, idx) => (
              <img
                key={url}
                src={url}
                alt={`${activeSheet.title} page ${idx + 1}`}
                referrerPolicy="no-referrer"
                onClick={() => setZoomSheet((prev) => !prev)}
                className={`rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] cursor-zoom-in transition-all duration-150 ${
                  zoomSheet ? 'max-w-none w-[140%]' : 'w-full h-auto object-contain'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Checklist of All Sub-Puzzles on this Sheet */}
        <div className="lg:col-span-6 space-y-3">
          {activeSheet.items.map((item) => {
            const key = `${activeSheet.id}-${item.index}`;
            const isSolved = Boolean(solvedWorksheetItems[key]);
            const isRevealed = Boolean(revealedAnswers[key]);
            const showClue = Boolean(revealedClues[key]);
            const currentVal = isSolved || isRevealed ? item.answer : inputs[key] || '';

            return (
              <div
                key={key}
                className={`p-4 rounded-xl border transition-colors ${
                  isSolved
                    ? 'bg-[var(--brand-soft-bg)] border-[var(--brand-soft-border)]'
                    : isRevealed
                    ? 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-700/50'
                    : 'bg-[var(--bg-card)] border-[var(--border-card)]'
                } ${wrongKey === key ? 'animate-shake border-red-400' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-zinc-400">
                    <span className="font-mono font-semibold text-stone-900 dark:text-zinc-100 tabular-nums">
                      Rebus Puzzle #{item.index}
                    </span>
                    <span className="font-mono tabular-nums">
                      ({item.wordPattern.join(', ')} letters)
                    </span>
                    {isSolved && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[var(--brand-text)] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Solved</span>
                        </span>
                      </>
                    )}
                    {!isSolved && isRevealed && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-800 dark:text-amber-400 font-medium">
                          Answer Revealed
                        </span>
                      </>
                    )}
                    {completionModal.status === 'counting' &&
                      completionModal.sheetId === activeSheet.id &&
                      completionModal.itemIndex === item.index && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[var(--brand-text)] tabular-nums">
                            Next prompt in {completionModal.secondsLeft}s...
                          </span>
                        </>
                      )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSolved && !isRevealed && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleClue(key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-zinc-300 bg-[var(--bg-subtle)] border border-[var(--border-card)] hover:opacity-90 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>{showClue ? 'Clue Active' : 'Hint'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevealItemAnswer(activeSheet, item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Reveal</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Form Row */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCheckItem(activeSheet, item);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={(el) => {
                      inputRefs.current[key] = el;
                    }}
                    type="text"
                    value={currentVal}
                    disabled={isSolved || isRevealed}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`Solve Rebus Puzzle #${item.index} (${item.wordPattern.join(', ')} letters)...`}
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] ${
                      isSolved
                        ? 'bg-[var(--bg-card)] border-[var(--brand-soft-border)] text-[var(--brand-text)] font-semibold'
                        : isRevealed
                        ? 'bg-[var(--bg-card)] border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-card)] text-stone-900 dark:text-zinc-100'
                    }`}
                  />
                  {!isSolved && !isRevealed && (
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Check
                    </button>
                  )}
                  {(isSolved || isRevealed) && (
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedAnswers((prev) => ({ ...prev, [key]: false }));
                        setInputs((prev) => ({ ...prev, [key]: '' }));
                      }}
                      title="Clear input"
                      className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </form>

                {/* Clue or Explanation Drawer */}
                {(showClue || isSolved || isRevealed) && (
                  <div className="mt-2.5 pt-2.5 border-t border-[var(--border-card)] text-xs text-stone-600 dark:text-zinc-400 space-y-1">
                    {showClue && !isSolved && !isRevealed && (
                      <p>
                        <strong className="text-stone-800 dark:text-zinc-200">Clue:</strong>{' '}
                        {item.clue} · First letters:{' '}
                        <span className="font-mono font-semibold text-stone-900 dark:text-zinc-100">
                          {item.firstLetters}
                        </span>
                      </p>
                    )}
                    {(isSolved || isRevealed) && item.explanation && (
                      <p>
                        <strong className="text-stone-800 dark:text-zinc-200">Breakdown:</strong>{' '}
                        {item.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-Second Delayed Next Puzzle Prompt Modal for Worksheet Sub-Puzzles */}
      {completionModal.status === 'open' &&
        completionModal.sheetId === activeSheet.id && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="worksheet-next-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-[2px] transition-opacity duration-150"
          >
            <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-6 shadow-xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-stone-500 dark:text-zinc-400 font-mono tabular-nums">
                    {activeSheet.title} · Rebus Puzzle #{completionModal.itemIndex}
                  </div>
                  <h2
                    id="worksheet-next-modal-title"
                    className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-100"
                  >
                    {completionModal.outcome === 'solved'
                      ? 'Worksheet Puzzle Solved!'
                      : 'Ready for the Next Puzzle?'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCompletionModal((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }))
                  }
                  aria-label="Close prompt"
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-zinc-400">Solution</span>
                  {completionModal.outcome === 'solved' ? (
                    <span className="font-mono font-semibold text-[var(--brand-text)] tabular-nums">
                      +{completionModal.pointsEarned} pts · {solvedCountForSheet}/
                      {activeSheet.totalCount} on Sheet
                    </span>
                  ) : (
                    <span className="font-mono text-amber-800 dark:text-amber-400">
                      Answer Revealed
                    </span>
                  )}
                </div>
                <div className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100">
                  {completionModal.answer}
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                  {completionModal.explanation}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCompletionModal((prev) => ({ ...prev, status: 'idle', secondsLeft: 3 }))
                  }
                  className="px-3.5 py-2.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Stay Here
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleJumpToNextUnsolvedItem}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    {solvedCountForSheet >= activeSheet.totalCount
                      ? 'Next Worksheet Set'
                      : 'Next Puzzle on Sheet'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
