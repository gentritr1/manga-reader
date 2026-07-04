import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExternalChapterNotice({
  externalUrl,
  mangaId,
  mangaTitle,
  chapterLabel,
  prevId,
  nextId,
}: {
  externalUrl: string | null;
  mangaId: string | null;
  mangaTitle: string;
  chapterLabel: string;
  prevId: string | null;
  nextId: string | null;
}) {
  const backHref = mangaId ? `/manga/${mangaId}` : "/";
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-4 text-center">
      <div className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">{mangaTitle}</p>
        <h1 className="text-2xl font-bold">{chapterLabel} is an official release</h1>
        <p className="text-sm text-muted-foreground">
          This chapter is licensed and hosted by the official publisher, so it
          can’t be read here. You can read it for free on the official site —
          please support the creators.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg">
                Read on official site <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
          <Link href={backHref} prefetch={false}>
            <Button variant="outline" size="lg">
              <ArrowLeft className="h-4 w-4" /> Back to title
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          {prevId && (
            <Link href={`/read/${prevId}`} prefetch={false}>
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
            </Link>
          )}
          {nextId && (
            <Link href={`/read/${nextId}`} prefetch={false}>
              <Button variant="ghost" size="sm">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
