// Epley estimated one-rep max: weight * (1 + reps/30). A single rep is its own
// 1RM. Lets a 5-rep PR and a 1-rep PR be compared on one scale.
export function estimate1RM(weightLbs: number, reps: number): number {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return 0;
  if (reps <= 1) return Math.round(weightLbs);
  return Math.round(weightLbs * (1 + reps / 30));
}
