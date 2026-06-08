"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Synopsis({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) {
    return <p className="text-sm text-muted-foreground">No description available.</p>;
  }
  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-line text-sm leading-relaxed text-muted-foreground",
          !expanded && "line-clamp-4",
        )}
      >
        {text}
      </p>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-1 text-sm font-medium text-accent hover:underline"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
