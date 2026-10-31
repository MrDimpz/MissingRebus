import React, { useState, useMemo } from 'react';
import { Search, CheckCircle2, ArrowUpRight, Eye } from 'lucide-react';
import { RebusChallenge } from '../data/rebusData';

interface ArchiveBrowserViewProps {
  puzzles: RebusChallenge[];
  solvedIds: Record<string, boolean>;
  revealedIds: Record<string, boolean>;
  onSelectPuzzle: (puzzleId: string) => void;
}

const CATEGORIES = [
  'All Categories',
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

export const ArchiveBrowserView: React.FC<ArchiveBrowserViewProps> = ({
  puzzles,
  solvedIds,
  revealedIds,
  onSelectPuzzle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return puzzles.filter((p) => {
      if (selectedCategory !== 'All Categories' && p.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'All' && p.difficulty !== selectedDifficulty) return false;
      if (statusFilter === 'solved' && !solvedIds[p.id]) return false;
      if (statusFilter === 'unsolved' && solvedIds[p.id]) return false;

      if (q) {
        const inTitle = p.title.toLowerCase().includes(q);
        const inDate = p.postDate.includes(q);
        const inId = String(p.postId).includes(q);
        const inCat = p.category.toLowerCase().includes(q);
        const inClue = p.blogClue.toLowerCase().includes(q);
        const inSolvedAns =
          (solvedIds[p.id] || revealedIds[p.id]) && p.answer.toLowerCase().includes(q);
        if (!inTitle && !inDate && !inId && !inCat && !inClue && !inSolvedAns) return false;
      }
      return true;
    });
  }, [puzzles, searchQuery, selectedCategory, selectedDifficulty, statusFilter, solvedIds, revealedIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Filter & Search Control Panel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-stone-500 dark:text-zinc-400">
              <span>Sequential Rebus Index (Rebus Puzzle #1 – #{puzzles.length})</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="tabular-nums">{filtered.length} Matching Challenges</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-100">
              Archive Challenge Catalog
            </h2>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Rebus Puzzle #1, #2, category, clue..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[var(--border-card)]">
          {/* Status Segmented Control */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unsolved', label: 'Unsolved' },
                { id: 'solved', label: 'Solved' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  statusFilter === tab.id
                    ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2.5">
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="flex-1 xs:flex-initial min-w-0 h-9 px-3 py-1 text-xs font-medium leading-normal bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by difficulty"
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 py-1 text-xs font-medium leading-normal bg-[var(--bg-subtle)] border border-[var(--border-card)] rounded-lg text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              <option value="All">All Difficulties</option>
              <option value="Standard">Standard</option>
              <option value="Medium">Medium</option>
              <option value="Challenging">Challenging</option>
            </select>
          </div>
        </div>
      </div>

      {/* Challenge Cards Grid */}
      {visibleItems.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-12 text-center space-y-3">
          <p className="font-display text-xl text-stone-800 dark:text-zinc-200">
            No matching rebus challenges found
          </p>
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            Try clearing your search query or switching category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All Categories');
              setSelectedDifficulty('All');
              setStatusFilter('all');
              setPage(1);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[var(--brand-primary)] rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((puzzle) => {
            const isSolved = Boolean(solvedIds[puzzle.id]);
            const isRevealed = Boolean(revealedIds[puzzle.id]);

            return (
              <div
                key={puzzle.id}
                className={`group bg-[var(--bg-card)] border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                  isSolved
                    ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft-bg)]'
                    : 'border-[var(--border-card)] hover:border-[var(--brand-soft-border)]'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top unboxed metadata row */}
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono tabular-nums text-stone-700 dark:text-zinc-300">
                        #{puzzle.postId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{puzzle.category}</span>
                    </div>
                  </div>

                  {/* Card Title: Sequential Rebus Puzzle #1, #2, #3... */}
                  <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100 leading-snug">
                    {puzzle.title}
                  </h3>

                  {/* Word pattern & difficulty metadata */}
                  <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-zinc-400 font-mono tabular-nums">
                    <span>Pattern: ({puzzle.wordPattern.join(', ')})</span>
                    <span aria-hidden="true">·</span>
                    <span>{puzzle.difficulty}</span>
                  </div>

                  {/* Preview snippet or solved answer */}
                  {isSolved ? (
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-text)]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Solved: {puzzle.answer}</span>
                    </div>
                  ) : isRevealed ? (
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Revealed: {puzzle.answer}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 dark:text-zinc-400 line-clamp-1">
                      First letters: <span className="font-mono">{puzzle.firstLetters}</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-[var(--border-card)] flex items-center justify-between">
                  <span className="text-xs text-stone-400 dark:text-zinc-500">
                    {puzzle.cropBox
                      ? 'Cropped PDF Card'
                      : puzzle.imageUrl
                      ? 'Visual Graphic'
                      : 'Typography Rebus'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPuzzle(puzzle.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{isSolved ? 'Review Challenge' : 'Play Challenge'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-5 py-3.5 text-xs text-stone-600 dark:text-zinc-400">
          <span className="font-mono tabular-nums">
            Page {currentPage} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 font-medium rounded-lg border border-[var(--border-card)] disabled:opacity-40 hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 font-medium rounded-lg border border-[var(--border-card)] disabled:opacity-40 hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
