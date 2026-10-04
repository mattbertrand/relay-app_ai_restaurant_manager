import React from "react";
import { isHtmlDraft } from "@/lib/draftText";
import { cn } from "@/lib/utils";

// Renders a draft response with real formatting: HTML drafts (edited in the
// rich editor) render as a formatted email — greeting, paragraphs, sign-off —
// while plain-text drafts keep their line breaks. Legacy plain-text drafts
// render unchanged until they are edited.
export default function RichDraft({ text, className, emptyLabel = "No draft prepared yet." }) {
  if (!text) {
    return <div className={cn("whitespace-pre-line", className)}>{emptyLabel}</div>;
  }
  if (isHtmlDraft(text)) {
    return <div className={cn("draft-rich min-w-0", className)} dangerouslySetInnerHTML={{ __html: text }} />;
  }
  return <div className={cn("whitespace-pre-line break-words min-w-0", className)}>{text}</div>;
}