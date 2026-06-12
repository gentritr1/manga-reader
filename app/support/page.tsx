import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Heart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { YomiMark } from "@/components/brand/yomi-mark";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support Yomi",
  description:
    "Support Yomi development with optional donations. MangaDex reading access stays free for everyone.",
};

const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;

const principles = [
  {
    title: "Limited ad testing",
    body: "Adsterra scripts are gated to the first two accounts and should stay disabled unless your content source allows ads.",
  },
  {
    title: "No paid reader access",
    body: "Browsing, search, chapters, saving, and reading history work the same whether you donate or not.",
  },
  {
    title: "Donations support upkeep",
    body: "Donations help cover hosting, maintenance, accessibility polish, and reader quality improvements.",
  },
];

const fundedWork = [
  "Reliable hosting, database, and monitoring costs",
  "Reader controls, accessibility presets, and mobile polish",
  "Library organization, export tools, and quality-of-life fixes",
  "Open product work that improves Yomi for every reader",
];

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <div className="flex items-center gap-3">
            <YomiMark className="h-12 w-12 shrink-0 [filter:drop-shadow(0_12px_22px_rgb(36_19_95_/_0.2))]" />
            <Badge variant="library">Optional donations</Badge>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-black tracking-tight text-content-primary text-balance sm:text-4xl">
              Support this reader.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-content-secondary text-pretty break-words">
              Yomi is free to use and not a paid service. Donations help cover
              hosting, maintenance, and development time. They do not change
              manga, chapter, speed, or feature access.
            </p>
          </div>

          <div className="grid gap-3 sm:flex sm:flex-wrap">
            {supportUrl ? (
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ size: "lg", className: "w-full sm:w-auto" })}
              >
                Make a donation
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  buttonClassName({ size: "lg", className: "w-full sm:w-auto" }),
                  "cursor-not-allowed opacity-60",
                )}
              >
                Donations are not open yet
              </span>
            )}
            <Link
              href="/browse"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
            >
              Browse manga
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className="min-w-0 rounded-card border border-library-line bg-library-surface p-5 text-library-foreground">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="text-base font-bold">Policy boundary</h2>
              <p className="text-sm leading-6 break-words">
                Donations support this app&apos;s operating costs; they are not
                payment for MangaDex content, chapter access, or API-provided data.
              </p>
              <a
                href="https://api.mangadex.org/docs/#acceptable-usage-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
              >
                Read MangaDex policy
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {principles.map((item) => (
          <article
            key={item.title}
            className="rounded-card border border-line-subtle bg-surface-panel p-5"
          >
            <CheckCircle2
              className="mb-4 h-5 w-5 text-library"
              aria-hidden="true"
            />
            <h2 className="text-base font-bold text-content-primary">
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-content-secondary">
              {item.body}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid min-w-0 gap-8 rounded-card border border-line-subtle bg-surface-panel p-5 sm:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-discovery-surface text-discovery-foreground">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-content-primary">
            What support funds
          </h2>
          <p className="text-sm leading-6 text-content-secondary">
            Donations help pay for upkeep. The app experience remains the same
            for every reader.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {fundedWork.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-lg bg-surface-muted/50 p-3 text-sm leading-6 text-content-secondary"
            >
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-discovery"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
