import React from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { isHtmlDraft, plainTextToHtml } from "@/lib/draftText";

// Rich text editor for draft responses. Compact toolbar — only what a
// professional email needs (bold, italics, lists, link); no headings, colors,
// or images. Plain-text drafts convert to simple paragraphs on open; edits
// save as HTML.
const MODULES = {
  toolbar: [["bold", "italic"], [{ list: "bullet" }, { list: "ordered" }], ["link"], ["clean"]],
};

export default function RichDraftEditor({ value, onChange }) {
  const htmlValue = isHtmlDraft(value) ? value : plainTextToHtml(value);
  return (
    <div className="draft-editor bg-card rounded-lg border border-border overflow-hidden">
      <ReactQuill theme="snow" value={htmlValue} onChange={onChange} modules={MODULES} />
    </div>
  );
}