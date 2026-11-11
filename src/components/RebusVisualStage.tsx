import React, { useState, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  Type,
  Image as ImageIcon,
  ExternalLink,
  FileDown,
  Grid,
  Square,
} from 'lucide-react';
import { RebusChallenge } from '../data/rebusData';

interface RebusVisualStageProps {
  puzzle: RebusChallenge;
  isSolved: boolean;
  hideFooter?: boolean;
  isStreamMode?: boolean;
}

export const RebusVisualStage: React.FC<RebusVisualStageProps> = ({
  puzzle,
  isSolved,
  hideFooter = false,
  isStreamMode = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showTextBlueprint, setShowTextBlueprint] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);

  useEffect(() => {
    setImageError(false);
    setIsZoomed(false);
    setShowFullSheet(false);
    setShowTextBlueprint(!puzzle.imageUrl && Boolean(puzzle.textRebus));
  }, [puzzle.id, puzzle.imageUrl, puzzle.textRebus]);

  const hasBothViews = Boolean(puzzle.imageUrl && puzzle.textRebus);
  const hasCropBox = Boolean(puzzle.cropBox);

  return (
    <div className="relative bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl overflow-hidden transition-all duration-150">
      {/* Stage Top Utility Bar */}
      <div className="flex items-center justify-between gap-2 px-3.5 sm:px-5 py-2.5 border-b border-[var(--border-card)] bg-[var(--bg-subtle)] text-xs text-stone-500 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-semibold text-stone-800 dark:text-zinc-200 tabular-nums shrink-0">
            {puzzle.title}
          </span>
          <span aria-hidden="true" className="hidden xs:inline">·</span>
          <span className="truncate text-stone-600 dark:text-zinc-400 hidden xs:inline">
            {puzzle.category}
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {hasCropBox && puzzle.imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => setShowFullSheet((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={showFullSheet ? 'Show isolated single puzzle card' : 'Show full PDF sheet'}
            >
              {showFullSheet ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Card</span>
                </>
              ) : (
                <>
                  <Grid className="w-3.5 h-3.5" />
                  <span>Full Sheet</span>
                </>
              )}
            </button>
          )}

          {hasBothViews && (
            <button
              type="button"
              onClick={() => setShowTextBlueprint((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {showTextBlueprint ? (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Image</span>
                </>
              ) : (
                <>
                  <Type className="w-3.5 h-3.5" />
                  <span>Text</span>
                </>
              )}
            </button>
          )}

          {puzzle.imageUrl && !imageError && !showTextBlueprint && (
            <button
              type="button"
              onClick={() => setIsZoomed((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={isZoomed ? 'Reset image size' : 'Expand rebus graphic'}
            >
              {isZoomed ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Fit</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Enlarge</span>
                </>
              )}
            </button>
          )}

          {puzzle.pdfUrl && (
            <a
              href={puzzle.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline transition-colors whitespace-nowrap shrink-0"
              title="Download Printable PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </a>
          )}

          <a
            href={puzzle.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            title="View original source article"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Visual Canvas */}
      <div className={`relative flex flex-col items-center justify-center bg-[var(--bg-card)] transition-all duration-150 w-full ${
        isStreamMode ? 'py-[3px] px-2 sm:px-4 min-h-[380px] sm:min-h-[480px] flex-1 h-full' : 'p-3 sm:p-5 min-h-[320px] sm:min-h-[420px]'
      }`}>
        {puzzle.imageUrl && !imageError && !showTextBlueprint ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center flex-1">
            {puzzle.cropBox && !showFullSheet ? (
              /* Isolated Single-Puzzle Card Crop from PDF Sheet */
              <div
                onClick={() => setIsZoomed((prev) => !prev)}
                className={`relative overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-xs cursor-zoom-in transition-all duration-150 my-[3px] ${
                  isStreamMode
                    ? 'w-full max-w-[620px] aspect-square max-h-[64vh] sm:max-h-[74vh] md:max-h-[80vh]'
                    : isZoomed
                    ? 'w-full max-w-[560px] aspect-square'
                    : 'w-full max-w-[460px] aspect-square'
                }`}
              >
                <img
                  src={puzzle.imageUrl}
                  alt={`${puzzle.title} (${puzzle.wordPattern.join(', ')} letters)`}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  style={{
                    position: 'absolute',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    width: `${(100 / puzzle.cropBox.w) * 100}%`,
                    height: `${(100 / puzzle.cropBox.h) * 100}%`,
                    left: `-${(puzzle.cropBox.x / puzzle.cropBox.w) * 100}%`,
                    top: `-${(puzzle.cropBox.y / puzzle.cropBox.h) * 100}%`,
                  }}
                  className="select-none pointer-events-none"
                />
              </div>
            ) : (
              /* Standard Standalone Rebus Image or Full Sheet View */
              <img
                src={puzzle.imageUrl}
                alt={`${puzzle.title} (${puzzle.wordPattern.join(', ')} letters)`}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                onClick={() => setIsZoomed((prev) => !prev)}
                className={`object-contain rounded-lg bg-[var(--bg-card)] select-none cursor-zoom-in transition-transform duration-150 w-full ${
                  isStreamMode
                    ? 'my-[3px] max-h-[64vh] sm:max-h-[74vh] md:max-h-[82vh] h-full'
                    : isZoomed
                    ? 'p-1 max-h-[560px] sm:max-h-[640px] h-full'
                    : 'p-1 max-h-[360px] sm:max-h-[480px] h-full'
                }`}
              />
            )}

            {puzzle.textRebus && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border-card)] w-full max-w-lg text-center">
                <p className="font-mono text-xs sm:text-sm text-stone-700 dark:text-zinc-300 whitespace-pre-line">
                  {puzzle.textRebus}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Resilient Typographic Letterpress Stage (for text rebuses or offline fallback) */
          <div className="w-full max-w-xl mx-auto py-6 px-4 sm:py-8 sm:px-6 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-card)] flex flex-col items-center justify-center text-center">
            {puzzle.textRebus ? (
              <div className="font-mono text-lg sm:text-2xl md:text-3xl font-semibold tracking-wide text-stone-900 dark:text-zinc-100 whitespace-pre-line leading-relaxed select-all">
                {puzzle.textRebus}
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <div className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                  {puzzle.title} · {puzzle.wordPattern.length}{' '}
                  {puzzle.wordPattern.length === 1 ? 'Word' : 'Words'} (
                  {puzzle.wordPattern.join(', ')} letters)
                </div>
                <div className="font-display text-xl sm:text-3xl font-semibold text-stone-900 dark:text-zinc-100 tracking-tight">
                  {puzzle.wordPattern.map((len, idx) => (
                    <span
                      key={idx}
                      className="inline-block mx-1 font-mono text-stone-800 dark:text-zinc-200"
                    >
                      {puzzle.firstLetters.split(', ')[idx] || '_'}
                      {'_'.repeat(Math.max(0, len - 1))}
                    </span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                  Clue Reference: {puzzle.blogClue}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt / Letter Count Footer Bar */}
      {!hideFooter && (
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-[var(--bg-subtle)] border-t border-[var(--border-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <p className="text-xs sm:text-sm text-stone-900 dark:text-stone-100 font-bold leading-snug">
            {puzzle.prompt}
          </p>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-stone-700 dark:text-stone-300 shrink-0 tabular-nums">
            <span>Word Lengths: ({puzzle.wordPattern.join(', ')})</span>
            {isSolved && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--brand-text)] font-semibold">SOLVED</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
