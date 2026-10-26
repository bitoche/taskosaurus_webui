/**
 * Calculates contrasting text color (#ffffff or #0f172a) based on background color luminance.
 * Uses the standard YIQ luminance formula to determine whether the background is light or dark.
 */
export function getContrastTextColor(hexColor?: string | null): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  // Expand shorthand hex (#fff -> #ffffff)
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) {
    return '#ffffff';
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '#ffffff';
  }
  // YIQ luminance formula: weights perceived brightness of R, G, B
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
}
