import React from "react";
import { Sparkles } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Demonstration data — explore the experience with sample opportunities and conversations.</span>
    </div>
  );
}