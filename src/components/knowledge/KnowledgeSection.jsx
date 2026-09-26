import React from "react";

// Card wrapper for one section of the restaurant knowledge editor.
export default function KnowledgeSection({ id, icon: Icon, title, description, children }) {
  return (
    <section id={id} className="bg-card rounded-xl border border-border p-5 md:p-6 scroll-mt-20">
      <div className="flex items-start gap-3 mb-5">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        )}
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}