export const AVATAR_COLORS = [
  '#4F46E5', // indigo-600
  '#7C3AED', // violet-600
  '#2563EB', // blue-600
  '#0891B2', // cyan-600
  '#059669', // emerald-600
  '#65A30D', // lime-600
  '#D97706', // amber-600
  '#EA580C', // orange-600
  '#DC2626', // red-600
  '#DB2777', // pink-600
  '#9333EA', // purple-600
  '#0D9488', // teal-600
];

/** Returns a deterministic color from the palette based on the given seed string. */
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
