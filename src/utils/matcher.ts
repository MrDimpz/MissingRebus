import { RebusChallenge } from '../data/rebusData';

const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '12': 'twelve',
  '20': 'twenty',
  '26': 'twentysix',
  '40': 'forty',
  '66': 'sixtysix',
  '404': 'fourhundredandfour',
};

/**
 * Normalizes a guess or canonical answer for resilient comparison.
 */
export function normalizePhrase(input: string): string {
  const lower = input
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  return lower
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function normalizeWithNumbersExpanded(input: string): string {
  const base = normalizePhrase(input);
  return base
    .split(' ')
    .map((token) => NUMBER_WORDS[token] || token)
    .join(' ');
}

/**
 * Checks whether a user's guess matches the puzzle's answer or accepted alternatives.
 */
export function checkAnswerMatch(guess: string, puzzle: Pick<RebusChallenge, 'answer' | 'acceptedAnswers'>): boolean {
  const cleanGuess = normalizePhrase(guess);
  if (!cleanGuess) return false;

  const cleanGuessExpanded = normalizeWithNumbersExpanded(guess);
  const cleanGuessNoSpaces = cleanGuess.replace(/\s+/g, '');

  const candidates = [puzzle.answer, ...(puzzle.acceptedAnswers || [])];

  for (const candidate of candidates) {
    const cleanCand = normalizePhrase(candidate);
    const cleanCandExpanded = normalizeWithNumbersExpanded(candidate);
    const cleanCandNoSpaces = cleanCand.replace(/\s+/g, '');

    if (
      cleanGuess === cleanCand ||
      cleanGuessExpanded === cleanCandExpanded ||
      cleanGuessNoSpaces === cleanCandNoSpaces
    ) {
      return true;
    }

    // Handle optional leading "a " or "the " if answer has 3+ words
    const stripArticle = (s: string) => s.replace(/^(a|an|the)\s+/i, '');
    if (cleanCand.split(' ').length >= 3 && stripArticle(cleanGuess) === stripArticle(cleanCand)) {
      return true;
    }
  }

  return false;
}

/**
 * Splits an answer into words and alphanumeric characters for the interactive letter-slot board.
 */
export interface WordSlotGroup {
  wordIndex: number;
  rawWord: string;
  letters: {
    globalIndex: number;
    char: string;
  }[];
}

export function buildWordSlotGroups(answer: string): { groups: WordSlotGroup[]; totalLetters: number } {
  const words = answer.trim().split(/\s+/);
  let globalIndex = 0;
  const groups: WordSlotGroup[] = [];

  words.forEach((word, wordIndex) => {
    const cleanChars = word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().split('');
    if (cleanChars.length > 0) {
      const letters = cleanChars.map((char) => ({
        globalIndex: globalIndex++,
        char,
      }));
      groups.push({
        wordIndex,
        rawWord: word,
        letters,
      });
    }
  });

  return { groups, totalLetters: globalIndex };
}
