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

  const unstructured = !/\n{2,}/.test(text);
  if (!unstructured) return text; // already has paragraph breaks — leave it alone

  const sig = String(signature || "").trim();

  // A flattened single-line copy of the configured signature (all signature
  // lines joined with spaces) must not stay inline — the signature is
  // appended exactly once, properly formatted, further down.
  if (sig && sig.includes("\n")) {
    const sigLines = sig.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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

  if (/\n{2,}/.test(text)) return text;

  // Restore the email structure of a single-line draft.
  text = text.replace(GREETING, "$1\n");
  text = text.replace(CLOSING, "$1\n$2,\n");
  return text.trimEnd();
}