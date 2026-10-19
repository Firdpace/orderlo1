/** Best-effort short device/browser label from userAgent. */

export function labelFromUserAgent(ua: string | null | undefined): string {
  if (!ua || !ua.trim()) return "Unknown device";
  const s = ua;

  let os = "Desktop";
  if (/iPhone|iPod/i.test(s)) os = "iPhone";
  else if (/iPad/i.test(s)) os = "iPad";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Mac OS X/i.test(s)) os = "Mac";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = "Safari";
  else if (/Firefox\//i.test(s)) browser = "Firefox";

  return `${browser} · ${os}`;
}

export function currentUserAgent(): string {
  try {
    return typeof navigator !== "undefined" ? navigator.userAgent : "";
  } catch {
    return "";
  }
}
