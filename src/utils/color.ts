/** Returns "#ffffff" for dark backgrounds, "#374151" for light ones. */
export function contrastText(bgColor: string): string {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#374151" : "#ffffff";
}

/** Returns a suitable stroke color for a filled shape. */
export function contrastStroke(fillColor: string): string {
  const hex = fillColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#374151" : "rgba(255,255,255,0.4)";
}
