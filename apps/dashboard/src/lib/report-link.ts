/** Only open actual HTTP(S) destinations; event properties are untrusted input. */
export function reportLink(
  dimension: string,
  value: unknown,
  website?: string | null,
): string | undefined {
  if (typeof value !== "string" || /[\s\p{Cc}\\]/u.test(value)) return;
  try {
    let url: URL;
    if (dimension === "property:path") {
      if (!website || !value.startsWith("/") || value.startsWith("//")) return;
      const base = new URL(website);
      url = new URL(value, base.origin);
      if (url.origin !== base.origin) return;
    } else if (dimension === "property:referrer") {
      if (/^https?:\/\//i.test(value)) url = new URL(value);
      else if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value))
        url = new URL(`https://${value}`);
      else return;
    } else return;
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch {
    return;
  }
}
