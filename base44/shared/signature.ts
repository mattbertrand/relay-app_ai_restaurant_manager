// Signature safety and assembly: a generated or regenerated draft must
// contain EXACTLY ONE signature block — never two copies. When the manager
// maintains a rich (HTML) email signature, the finished draft is stored as
// HTML — body paragraphs + the signature HTML — so the rich signature is
// never flattened back to plain text. Plain-text signatures keep the
// existing plain-text draft format.

import { normalizeDraftParagraphs } from "./draftFormatting.ts";

export function ensureSingleSignature(draft, signature) {
  const text = String(draft || "").trim();
  const sig = String(signature || "").trim();
  if (!text || !sig) return text;

  const sigLines = sig.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
  if (!sigLines.length) return text;
  const lines = text.split(/\r?\n/);

  const matches = [];
  for (let i = 0; i <= lines.length - sigLines.length; i++) {
    let ok = true;
    for (let j = 0; j < sigLines.length; j++) {
      if (lines[i + j].trim().toLowerCase() !== sigLines[j].toLowerCase()) { ok = false; break; }
    }
    if (ok) matches.push(i);
  }

  if (matches.length <= 1) {
    if (matches.length === 1) return text;
    const kept = [...lines];
    if (sigLines.length === 1) {
      const sigLower = sigLines[0].toLowerCase();
      for (let i = kept.length - 1; i >= 0; i--) {
        if (!kept[i].trim()) continue;
        const line = kept[i].trim();
        const lineLower = line.toLowerCase();
        if (lineLower !== sigLower && lineLower.endsWith(sigLower) && lineLower.length > sigLower.length) {
          kept[i] = line.slice(0, line.length - sigLines[0].length).trimEnd();
        }
        break;
      }
    }
    while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
    return [...kept, "", sig].join("\n");
  }

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

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain-text draft body → simple email paragraphs (the same structure the
// rich editor produces when it opens a plain-text draft).
function paragraphsToHtml(text) {
  const paras = String(text || "").split(/\n{2,}/).filter((p) => p.trim() !== "");
  if (!paras.length) return "<p><br></p>";
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// Removes a signature block (matched line-for-line, case- and
// whitespace-insensitively) from the end of a plain-text draft.
function removeTrailingSignature(text, signature) {
  const sig = String(signature || "").trim();
  if (!sig) return String(text || "").trim();
  const sigLines = sig.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!sigLines.length) return String(text || "").trim();
  let lines = String(text || "").split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length >= sigLines.length) {
    let ok = true;
    for (let j = 0; j < sigLines.length; j++) {
      if (lines[lines.length - sigLines.length + j].trim().toLowerCase() !== sigLines[j].toLowerCase()) {
        ok = false;
        break;
      }
    }
    if (ok) lines = lines.slice(0, lines.length - sigLines.length);
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  // A flattened single-line copy of the signature must not survive either.
  if (sigLines.length > 1) {
    let joined = lines.join("\n");
    const flattened = sigLines.join(" ");
    const idx = joined.toLowerCase().lastIndexOf(flattened.toLowerCase());
    if (idx >= 0) joined = (joined.slice(0, idx) + joined.slice(idx + flattened.length)).trim();
    lines = joined.split("\n");
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n").trimEnd();
}

// Final draft assembly for a generated response: with a rich signature, the
// result is "email body HTML + signature HTML"; without one, the historical
// plain-text draft with exactly one text signature.
export function finalizeDraft(draft, signature, signatureHtml, restaurantName) {
  const normalized = normalizeDraftParagraphs(draft, signature, restaurantName);
  const withSingle = ensureSingleSignature(normalized, signature);
  if (!signatureHtml) return withSingle;
  const body = removeTrailingSignature(withSingle, signature);
  return paragraphsToHtml(body) + "\n" + String(signatureHtml);
}