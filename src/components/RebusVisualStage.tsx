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
}

export const RebusVisualStage: React.FC<RebusVisualStageProps> = ({ puzzle, isSolved }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showTextBlueprint, setShowTextBlueprint] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setIsZoomed(false);
    setShowFullSheet(false);
    setShowTextBlueprint(!puzzle.imageUrl && Boolean(puzzle.textRebus));
  }, [puzzle.id, puzzle.imageUrl, puzzle.textRebus]);

  const hasBothViews = Boolean(puzzle.imageUrl && puzzle.textRebus);
  const hasCropBox = Boolean(puzzle.cropBox);

  return (
    <div className="relative bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 rounded-xl overflow-hidden transition-all duration-150">
      {/* Stage Top Utility Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 text-xs text-stone-500 dark:text-zinc-400">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-semibold text-stone-800 dark:text-zinc-200 tabular-nums truncate">
            {puzzle.title}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate text-stone-600 dark:text-zinc-400">{puzzle.category}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="tabular-nums shrink-0 hidden sm:inline">{puzzle.postDate}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasCropBox && puzzle.imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => setShowFullSheet((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={showFullSheet ? 'Show isolated single puzzle card' : 'Show full PDF sheet'}
            >
              {showFullSheet ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Single Card</span>
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {showTextBlueprint ? (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Image View</span>
                </>
              ) : (
                <>
                  <Type className="w-3.5 h-3.5" />
                  <span>Typography View</span>
                </>
              )}
            </button>
          )}

          {puzzle.imageUrl && !imageError && !showTextBlueprint && (
            <button
              type="button"
              onClick={() => setIsZoomed((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={isZoomed ? 'Reset image size' : 'Expand rebus graphic'}
            >
              {isZoomed ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Standard Fit</span>
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
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5132] dark:text-emerald-400 hover:underline transition-colors whitespace-nowrap shrink-0"
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
      <div
        className={`relative flex flex-col items-center justify-center p-6 sm:p-10 transition-all duration-150 ${
          isZoomed
            ? 'min-h-[420px] bg-white dark:bg-zinc-900'
            : 'min-h-[290px] sm:min-h-[330px] bg-white dark:bg-zinc-900'
        }`}
      >
        {puzzle.imageUrl && !imageError && !showTextBlueprint ? (
          <div className="relative w-full flex flex-col items-center justify-center">
            {!imageLoaded && (
              <div className="w-full max-w-md h-56 rounded-lg bg-stone-100 dark:bg-zinc-800 animate-pulse flex flex-col items-center justify-center gap-2 text-stone-400 dark:text-zinc-500">
                <span className="text-xs font-mono uppercase tracking-wider">
                  Loading {puzzle.title}...
                </span>
              </div>
            )}

            {puzzle.cropBox && !showFullSheet ? (
              /* Isolated Single-Puzzle Card Crop from PDF Sheet */
              <div
                onClick={() => setIsZoomed((prev) => !prev)}
                className={`relative overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700 bg-white shadow-xs cursor-zoom-in transition-all duration-150 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0 h-0'
                } ${
                  isZoomed
                    ? 'w-80 h-80 sm:w-[400px] sm:h-[400px]'
                    : 'w-64 h-64 sm:w-80 sm:h-80'
                }`}
              >
                <img
                  src={puzzle.imageUrl}
                  alt={`${puzzle.title} (${puzzle.wordPattern.join(', ')} letters)`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageLoaded(true)}
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
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => setIsZoomed((prev) => !prev)}
                className={`object-contain rounded-lg bg-white p-1 select-none cursor-zoom-in transition-transform duration-150 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0 h-0'
                } ${
                  isZoomed
                    ? 'max-h-[540px] w-auto scale-105'
                    : 'max-h-[300px] sm:max-h-[340px] w-auto'
                }`}
              />
            )}

            {puzzle.textRebus && imageLoaded && (
              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-zinc-800 w-full max-w-lg text-center">
                <p className="font-mono text-sm text-stone-700 dark:text-zinc-300 whitespace-pre-line">
                  {puzzle.textRebus}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Resilient Typographic Letterpress Stage (for text rebuses or offline fallback) */
          <div className="w-full max-w-xl mx-auto my-auto py-8 px-6 rounded-xl bg-[#FAF9F5] dark:bg-zinc-950 border border-stone-200/80 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
            {puzzle.textRebus ? (
              <div className="font-mono text-xl sm:text-2xl md:text-3xl font-semibold tracking-wide text-stone-900 dark:text-zinc-100 whitespace-pre-line leading-relaxed select-all">
                {puzzle.textRebus}
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                  {puzzle.title} · {puzzle.wordPattern.length}{' '}
                  {puzzle.wordPattern.length === 1 ? 'Word' : 'Words'} (
                  {puzzle.wordPattern.join(', ')} letters)
                </div>
                <div className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-zinc-100 tracking-tight">
                  {puzzle.wordPattern.map((len, idx) => (
                    <span
                      key={idx}
                      className="inline-block mx-1.5 font-mono text-stone-800 dark:text-zinc-200"
                    >
                      {puzzle.firstLetters.split(', ')[idx] || '_'}
                      {'_'.repeat(Math.max(0, len - 1))}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                  Clue Reference: {puzzle.blogClue}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt / Letter Count Footer Bar */}
      <div className="px-5 py-3.5 bg-[#FAF9F5] dark:bg-zinc-950 border-t border-stone-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-stone-700 dark:text-zinc-300 leading-snug">{puzzle.prompt}</p>
        <div className="flex items-center gap-2 text-xs font-mono text-stone-600 dark:text-zinc-400 shrink-0 tabular-nums">
          <span>Word Lengths: ({puzzle.wordPattern.join(', ')})</span>
          {isSolved && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#0F5132] dark:text-emerald-400 font-semibold">SOLVED</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
