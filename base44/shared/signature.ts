// Signature safety: a generated or regenerated draft must contain EXACTLY ONE
// signature block — never two copies (e.g. when a signature is appended to a
// draft that already ended with one). Works on plain-text drafts, which is the
// format analysis produces; rich-text editing happens later, per draft.
export function ensureSingleSignature(draft, signature) {
  const text = String(draft || "").trim();
  const sig = String(signature || "").trim();
  if (!text || !sig) return text;

  const sigLines = sig.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
  if (!sigLines.length) return text;
  const lines = text.split(/\r?\n/);

  // Find every window of consecutive lines matching the signature block
  // (whitespace-insensitive, so an indentation difference still matches).
  const matches = [];
  for (let i = 0; i <= lines.length - sigLines.length; i++) {
    let ok = true;
    for (let j = 0; j < sigLines.length; j++) {
      if (lines[i + j].trim() !== sigLines[j]) { ok = false; break; }
    }
    if (ok) matches.push(i);
  }

  if (matches.length <= 1) {
    // Zero or one occurrence — collapse trailing blank lines and make sure the
    // single signature sits at the very end with one blank line before it.
    if (matches.length === 1) return text;
    const kept = [...lines];
    while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
    return [...kept, "", sig].join("\n");
  }

  // Two or more copies: remove every occurrence (plus the blank lines right
  // before each block), then append exactly one at the end.
  const remove = new Set();
  for (const start of matches) {
    for (let k = 0; k < sigLines.length; k++) remove.add(start + k);
    let before = start - 1;
    while (before >= 0 && lines[before].trim() === "") { remove.add(before); before--; }
  }
  const kept = lines.filter((_, idx) => !remove.has(idx));
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  return [...kept, "", sig].join("\n");
}