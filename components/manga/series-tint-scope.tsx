import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_SERIES_TINT } from "@/lib/extract-tint";

export function SeriesTintScope({
  mangaId,
  className,
  children,
}: {
  mangaId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-yomi-series-tint-scope
      data-yomi-series-tint-id={mangaId}
      className={className}
      style={{ "--series-tint": DEFAULT_SERIES_TINT } as CSSProperties}
    >
      {children}
    </div>
  );
}
