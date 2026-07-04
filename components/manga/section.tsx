import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Section({
  title,
  description,
  href,
  actionLabel = "See all",
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="text-sm leading-6 text-content-secondary sm:text-base">
              {description}
            </p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            aria-label={`${actionLabel}: ${title}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-lg text-sm font-medium text-content-secondary transition hover:text-brand-primary focus-visible:text-brand-primary sm:self-auto"
          >
            {actionLabel} <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
