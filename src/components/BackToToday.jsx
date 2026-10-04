import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// Today is the manager's home base — every working page shows the path back.
export default function BackToToday({ label }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3" aria-label="Breadcrumb">
      <Link to="/today" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Today
      </Link>
      <span className="text-border">/</span>
      <span className="text-foreground font-medium">{label}</span>
    </nav>
  );
}