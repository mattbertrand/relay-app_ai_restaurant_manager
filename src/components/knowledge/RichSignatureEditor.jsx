import React, { useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Upload } from "lucide-react";

// Rich email-signature editor. The manager can paste an existing signature
// straight from Gmail/Outlook: paragraphs, line breaks, bold/italic/underline,
// links, basic formatting, and images all survive. Pasted HTML is sanitized to
// a safe subset, and clipboard images are imported into Relay-managed storage
// when possible; email-internal images (cid: references) cannot be resolved
// from a copy, so a manual upload fallback is offered instead of silently
// dropping the whole signature.
const TOOLBAR_MODULES = {
  toolbar: {
    container: [["bold", "italic", "underline"], ["link", "image"], ["clean"]],
    handlers: {},
  },
};

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "S", "A", "UL", "OL", "LI",
  "IMG", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6",
  "FONT", "SUB", "SUP", "HR", "BLOCKQUOTE",
]);
const ALLOWED_ATTRS = new Set(["href", "src", "alt", "width", "height", "colspan", "rowspan", "style", "dir"]);

// Sanitize pasted/edited signature HTML: keep a safe subset of tags, drop
// scripts, styles, embeds and inline event handlers entirely, and restrict
// URLs and CSS to safe values.
export function sanitizeSignatureHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const body = doc.body;
  body.querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, video, audio, svg, base").forEach((el) => el.remove());
  // Unwrap disallowed tags so their text content survives.
  Array.from(body.querySelectorAll("*"))
    .filter((el) => !ALLOWED_TAGS.has(el.tagName))
    .forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === "href" && !/^(https?:|mailto:|tel:)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
      if (name === "src" && !/^(https?:|data:image\/)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
      if (name === "style") {
        attr.value = String(attr.value)
          .replace(/expression\s*\(/gi, "")
          .replace(/url\(\s*(['"]?)\s*(?!https?:|data:image\/)[^)]*\)/gi, "")
          .replace(/position\s*:\s*fixed/gi, "");
      }
    });
  });
  return body.innerHTML;
}

function legacyPlainTextToHtml(text) {
  const t = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = t.split(/\n/);
  if (!lines.filter((l) => l.trim()).length) return "<p><br></p>";
  return lines.map((l) => `<p>${l || "<br>"}</p>`).join("");
}

async function uploadImageBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const res = await base44.integrations.Core.UploadPublicFile({ file });
  return res.file_url;
}

export default function RichSignatureEditor({ value, onChange }) {
  const quillRef = useRef(null);
  const timerRef = useRef(null);
  const seenSrcsRef = useRef(new Set());
  const [imageWarning, setImageWarning] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(
    value.signature_html || legacyPlainTextToHtml(value.email_signature)
  );
  const fileInputRef = useRef(null);

  const initialHtml = value.signature_html
    ? value.signature_html
    : legacyPlainTextToHtml(value.email_signature);

  const emit = () => {
    const quill = quillRef.current && quillRef.current.getEditor();
    if (!quill) return;
    const html = sanitizeSignatureHtml(quill.root.innerHTML);
    const text = quill.getText().trim();
    setPreviewHtml(html);
    onChange({ signature_html: html, signature_text: text, email_signature: text });
  };

  // Import clipboard images: data URLs (pasted images) are uploaded to
  // Relay-managed storage; accessible http(s) URLs are re-hosted when the
  // fetch succeeds and kept as URLs otherwise; email-internal references
  // (cid:) can't be resolved from a copy and are removed with a warning.
  const importImages = async () => {
    const quill = quillRef.current && quillRef.current.getEditor();
    if (!quill) return;
    const imgs = Array.from(quill.root.querySelectorAll("img"));
    const pending = imgs.filter((img) => {
      const src = img.getAttribute("src") || "";
      return src && !seenSrcsRef.current.has(src);
    });
    if (!pending.length) return;
    let warned = false;
    const processed = new Map();
    for (const img of pending) {
      const src = img.getAttribute("src") || "";
      seenSrcsRef.current.add(src);
      if (/^data:image\//i.test(src)) {
        try {
          const blob = await (await fetch(src)).blob();
          const ext = (blob.type.split("/")[1] || "png").split(";")[0];
          const url = await uploadImageBlob(blob, "signature-image." + ext);
          if (url) processed.set(src, url);
        } catch (e) {
          processed.set(src, null); // remove the unimportable image, keep the signature
          warned = true;
        }
      } else if (/^https?:/i.test(src)) {
        try {
          const res = await fetch(src, { mode: "cors" });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.type && blob.type.startsWith("image/")) {
              const ext = (blob.type.split("/")[1] || "png").split(";")[0];
              const url = await uploadImageBlob(blob, "signature-image." + ext);
              if (url) processed.set(src, url);
            }
          }
        } catch (e) {
          // Keep the accessible external URL when re-hosting isn't possible.
        }
      } else {
        processed.set(src, null); // cid: and other email-internal references
        warned = true;
      }
    }
    if (processed.size) {
      const html = sanitizeSignatureHtml(quill.root.innerHTML);
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (processed.has(src)) {
          const url = processed.get(src);
          if (url) img.setAttribute("src", url);
          else img.remove();
        }
      });
      const finalHtml = doc.body.innerHTML || "<p><br></p>";
      seenSrcsRef.current = new Set(
        Array.from(doc.querySelectorAll("img")).map((i) => i.getAttribute("src") || "").filter(Boolean)
      );
      // Re-sync the editor with the processed content so model and DOM agree.
      quill.setContents(quill.clipboard.convert(finalHtml), "silent");
    }
    setImageWarning(warned);
    emit();
  };

  const handleChange = () => {
    emit();
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => importImages(), 400);
  };

  // Toolbar image button: upload the chosen file and insert the stored URL.
  const modules = {
    toolbar: {
      container: TOOLBAR_MODULES.toolbar.container,
      handlers: {
        image: () => {
          const quill = quillRef.current && quillRef.current.getEditor();
          if (!quill) return;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
              const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
              const range = quill.getSelection(true);
              quill.insertEmbed(range ? range.index : quill.getLength(), "image", file_url, "user");
            } catch (e) {
              // Upload failed — nothing inserted, the signature stays intact.
            }
          };
          input.click();
        },
      },
    },
  };

  const uploadFallback = () => {
    const quill = quillRef.current && quillRef.current.getEditor();
    const input = fileInputRef.current;
    if (!quill || !input) return;
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        quill.insertEmbed(quill.getLength(), "image", file_url, "user");
        setImageWarning(false);
        emit();
      } catch (e) {
        // Upload failed — the signature stays intact.
      }
      input.value = "";
    };
    input.click();
  };

  return (
    <div>
      <div className="draft-editor bg-card rounded-lg border border-border overflow-hidden w-full min-w-0">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          defaultValue={initialHtml}
          onChange={handleChange}
          modules={modules}
        />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
      {imageWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 mt-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-amber-800">
              Some signature images could not be imported. You can upload the logo manually.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={uploadFallback}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload image
            </Button>
          </div>
        </div>
      )}
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
        <div
          className="draft-rich rounded-lg border border-border bg-card p-4 text-sm min-h-[3rem]"
          dangerouslySetInnerHTML={{ __html: previewHtml || "<p><br></p>" }}
        />
      </div>
    </div>
  );
}