// Generated drafts must read like a real email: greeting on its own line,
// paragraphs separated by blank lines, closing on its own line, and the
// signature on its own lines. Model output occasionally returns the whole
// draft as one long line — this normalizer restores the structure
// deterministically, and leaves drafts that are already formatted untouched.

const GREETING = /^((?:Hi|Hello|Dear|Hey|Good (?:morning|afternoon|evening))\b[^,\n]{0,60},)\s*/i;
const CLOSING = /([.!?])\s+((?:Best|Kind|Warm|Sincere)\s+regards|Best|Regards|Sincerely|Thank you|Thanks|Cheers)\s*,\s*/i;

export function normalizeDraftParagraphs(draft, signature, restaurantName) {
  let text = String(draft || "").trim();
  if (!text) return text;

  const sig = String(signature || "").trim();

  // Strip every copy of the configured signature the model may already have
  // written — in structured drafts and flattened ones alike, letter-case and
  // whitespace differences included. The signature is appended exactly once,
  // properly formatted, further down.
  if (sig && sig.includes("\n")) {
    const sigLines = sig.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sigLower = sigLines.map((l) => l.toLowerCase());
    let lines = text.split(/\r?\n/);
    let stripped = true;
    while (stripped) {
      stripped = false;
      const lower = lines.map((l) => l.trim().toLowerCase());
      for (let i = lower.length - sigLower.length; i >= 0; i--) {
        let ok = true;
        for (let j = 0; j < sigLower.length; j++) {
          if (lower[i + j] !== sigLower[j]) { ok = false; break; }
        }
        if (ok) {
          lines = lines.slice(0, i);
          while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
          stripped = true;
          break;
        }
      }
    }
    text = lines.join("\n").trimEnd();

    // A flattened single-line copy of the configured signature (all signature
    // lines joined with spaces) must not stay inline either.
    if (sigLines.length > 1) {
      const flattened = sigLines.join(" ");
      const idx = text.toLowerCase().lastIndexOf(flattened.toLowerCase());
      if (idx >= 0) {
        text = (text.slice(0, idx) + text.slice(idx + flattened.length)).trim();
      }
    }
  }

  // A trailing restaurant-name sign-off would duplicate the signature block
  // about to be appended — drop it when a signature is configured.
  const name = String(restaurantName || "").trim();
  if (sig && name) {
    const lower = text.toLowerCase();
    if (lower.endsWith(name.toLowerCase())) {
      text = text.slice(0, text.length - name.length).trimEnd().replace(/[,;]$/, "").trimEnd();
    }
  }

  const unstructured = !/\n{2,}/.test(text);
  if (!unstructured) return text; // already has paragraph breaks — leave it alone

  // Restore the email structure of a single-line draft.
  text = text.replace(GREETING, "$1\n");
  text = text.replace(CLOSING, "$1\n$2,\n");
  return text.trimEnd();
}