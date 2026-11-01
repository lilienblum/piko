export const sourceIcons = [
  ["website", "Website"],
  ["ios", "iOS"],
  ["android", "Android"],
  ["mobile", "Mobile"],
  ["terminal", "Terminal"],
  ["desktop", "Desktop"],
  ["server", "Server"],
  ["code", "Code"],
  ["package", "Package"],
  ["game", "Game"],
  ["generic", "Cube"],
] as const;
export type SourceIconId = (typeof sourceIcons)[number][0];

/** A visual hint from the name only; never used to filter data or infer identity. */
export function inferSourceIcon(name: string): SourceIconId {
  const words = name
    .replace(/iOS/g, "IOS")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  if (/\b(ios|iphone|ipad)\b/.test(words)) return "ios";
  if (/\bandroid\b/.test(words)) return "android";
  if (/\b(cli|terminal|shell|command)\b/.test(words)) return "terminal";
  if (/\b(website|web|site|browser|www)\b/.test(words) || /\.[a-z]{2,}(?:\/|$)/.test(words))
    return "website";
  if (/\b(api|server|backend|service)\b/.test(words)) return "server";
  if (/\b(desktop|macos|windows|linux|mac)\b/.test(words)) return "desktop";
  if (/\b(sdk|library|package|plugin|extension)\b/.test(words)) return "package";
  if (/\b(code|developer|dev|tool)\b/.test(words)) return "code";
  if (/\b(game|gaming)\b/.test(words)) return "game";
  if (/\b(mobile|phone|tablet|app)\b/.test(words)) return "mobile";
  return "generic";
}
export function resolveSourceIcon(source: {
  name: string;
  icon?: SourceIconId | null;
}): SourceIconId {
  return source.icon ?? inferSourceIcon(source.name);
}
