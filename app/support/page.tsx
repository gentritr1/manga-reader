import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { YomiMark } from "@/components/brand/yomi-mark";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support Manga Orbit",
  description:
    "Support Manga Orbit development with optional donations. MangaDex reading access stays free for everyone.",
};

const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;

const options = [
  {
    amount: "$5",
    title: "Keep the database running",
    description: "Covers a full month of fast, reliable database hosting so the reader stays snappy for thousands of people.",
  },
  {
    amount: "$15",
    title: "Fund new features",
    description: "Buys the coffee that keeps the code shipping. A massive help for ongoing polish and major architecture updates.",
  },
  {
    amount: "$50",
    title: "Long-term stability",
    description: "Secures domain renewals and covers the heavy infrastructure costs for months. True peace of mind for the project.",
  },
];

export default function SupportPage() {
  return (
    <main className="flex-1 w-full bg-surface-canvas pb-24 pt-16 sm:pt-24 lg:pt-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        
        {/* Header section without generic hero tropes */}
        <div className="mb-20 max-w-3xl">
          <YomiMark className="mb-10 h-12 w-12 text-content-primary" />
          <h1 className="text-4xl font-black tracking-tight text-content-primary sm:text-6xl md:text-7xl lg:text-[5.5rem] [text-wrap:balance]">
            Keep the shelf open.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-content-secondary sm:text-xl">
            Manga Orbit is completely free, ad-free, and maintained by fellow fans.
            Browsing is always free. Your donations strictly cover our 
            database and hosting costs so the reader stays fast.
          </p>
        </div>

        {/* Asymmetrical List Layout (No Cards) */}
        <div className="border-t border-line-subtle pt-12">
          <h2 className="mb-10 text-sm font-bold uppercase tracking-widest text-content-secondary">
            Ways to help
          </h2>
          
          <div className="grid gap-x-12 gap-y-16 lg:grid-cols-[1fr_1fr]">
            {/* The Options */}
            <div className="flex flex-col gap-10">
              {options.map((option, i) => (
                <div key={i} className="group relative flex flex-col gap-1 sm:flex-row sm:gap-6 lg:flex-col lg:gap-1">
                  <div className="w-24 shrink-0 text-3xl font-black tracking-tight text-content-primary sm:text-4xl">
                    {option.amount}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-content-primary mb-2">
                      {option.title}
                    </h3>
                    <p className="text-base leading-relaxed text-content-secondary max-w-md">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
              
              <div className="pt-6">
                {supportUrl ? (
                  <a
                    href={supportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClassName({
                      size: "lg",
                      className: "w-full sm:w-auto"
                    })}
                  >
                    Make a donation
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(
                      buttonClassName({
                        variant: "outline",
                        size: "lg",
                        className: "w-full sm:w-auto cursor-not-allowed opacity-60"
                      })
                    )}
                  >
                    Donations closed right now
                  </span>
                )}
              </div>
            </div>

            {/* Typography-driven transparency notes */}
            <div className="flex flex-col gap-10 lg:pl-12 lg:border-l lg:border-line-subtle">
              <div>
                <h3 className="mb-3 text-lg font-bold text-content-primary">
                  The MangaDex Connection
                </h3>
                <p className="text-base leading-relaxed text-content-secondary mb-4 max-w-md">
                  Donations support Manga Orbit&apos;s operating costs only. They are never
                  used as payment for MangaDex content, chapter access, or API data.
                </p>
                <a
                  href="https://api.mangadex.org/docs/#acceptable-usage-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-content-primary underline decoration-line-subtle underline-offset-4 hover:decoration-content-primary transition-all"
                >
                  Read their policy
                  <ExternalLink className="h-3.5 w-3.5 text-content-secondary transition-colors group-hover:text-content-primary" aria-hidden="true" />
                </a>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-bold text-content-primary">
                  Everything stays free
                </h3>
                <p className="text-base leading-relaxed text-content-secondary mb-4 max-w-md">
                  Browsing, search, saving favorites, and your entire reading history 
                  work identically whether you choose to donate or not. There are no paywalls here.
                </p>
                <Link
                  href="/browse"
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-content-primary underline decoration-line-subtle underline-offset-4 hover:decoration-content-primary transition-all"
                >
                  Go browse manga
                  <ArrowRight className="h-3.5 w-3.5 text-content-secondary transition-transform group-hover:translate-x-1 group-hover:text-content-primary" aria-hidden="true" />
                </Link>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </main>
  );
}
