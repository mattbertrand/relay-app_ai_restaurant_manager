// Draft responses are stored as plain text (generated drafts keep their line
// breaks) or as HTML (saved from the rich text editor). These helpers keep
// both paths consistent everywhere drafts are shown or edited.

const HTML_TAGS = /<\/?(p|div|br|ul|ol|li|strong|em|b|i|u|s|a|span|h[1-6])\b[^>]*>/i;

// A draft counts as HTML only when it carries tags the rich editor produces —
// an LLM draft containing a stray "<3" still renders as plain text.
export function isHtmlDraft(text) {
  return typeof text === "string" && HTML_TAGS.test(text);
}

// Legacy plain-text drafts convert to simple paragraphs when opened in the
// rich editor, so line breaks survive the transition to HTML.
export function plainTextToHtml(text) {
  const t = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = t.split(/\n{2,}/).filter((p) => p.trim() !== "");
  if (!paras.length) return "<p><br></p>";
  return paras.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

// HTML draft → plain text, for comparisons (dirty checks, draft_edited
// detection) and any future plain-text consumer such as a real email body.
export function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<\/(p|div|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}