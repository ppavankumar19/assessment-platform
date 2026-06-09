export function normalizeOutput(raw: string): string {
  return raw
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .toLowerCase();
}

export function scoreOutputPrediction(
  predicted: string,
  expected: string,
  points: number
): { score: number; correct: boolean } {
  const correct = normalizeOutput(predicted) === normalizeOutput(expected);
  return { score: correct ? points : 0, correct };
}
