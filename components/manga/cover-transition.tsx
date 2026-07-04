"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type CoverTransitionLinkProps = ComponentProps<typeof Link> & {
  mangaId: string;
};

const COVER_TRANSITION_ATTR = "data-yomi-cover-transition";
const ACTIVE_COVER_ATTR = "data-yomi-active-cover-transition";

export function coverTransitionName(mangaId: string) {
  return `cover-${mangaId}`;
}

function supportsViewTransitions() {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

function clearActiveCoverTransitions() {
  document
    .querySelectorAll<HTMLElement>(`[${ACTIVE_COVER_ATTR}]`)
    .forEach((element) => {
      element.style.viewTransitionName = "";
      element.removeAttribute(ACTIVE_COVER_ATTR);
    });
}

function findCoverTransitionElement(mangaId: string, source: Element | null) {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[${COVER_TRANSITION_ATTR}]`),
  ).filter((element) => element.dataset.yomiCoverTransition === mangaId);

  if (source) {
    const scope = source.closest<HTMLElement>(
      "[data-yomi-cover-transition-root]",
    );
    const scoped = scope
      ? candidates.find((element) => scope.contains(element))
      : null;
    if (scoped) return scoped;

    const direct = candidates.find((element) => element.contains(source));
    if (direct) return direct;
  }

  return candidates.find((element) => element.dataset.yomiCoverPreferred) ??
    candidates[0] ??
    null;
}

export function prepareCoverTransition(mangaId: string, source?: Element | null) {
  if (!supportsViewTransitions()) return;

  clearActiveCoverTransitions();

  const cover = findCoverTransitionElement(mangaId, source ?? null);
  if (!cover) return;

  cover.style.viewTransitionName = coverTransitionName(mangaId);
  cover.setAttribute(ACTIVE_COVER_ATTR, "true");
}

export function CoverTransitionLink({
  mangaId,
  onClick,
  onPointerDown,
  ...props
}: CoverTransitionLinkProps) {
  return (
    <Link
      {...props}
      onPointerDown={(event) => {
        prepareCoverTransition(mangaId, event.currentTarget);
        onPointerDown?.(event);
      }}
      onClick={(event) => {
        prepareCoverTransition(mangaId, event.currentTarget);
        onClick?.(event);
      }}
    />
  );
}

export function CoverTransitionElement({
  mangaId,
  active = false,
  preferred = false,
  className,
  children,
}: {
  mangaId: string;
  active?: boolean;
  preferred?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-yomi-cover-transition={mangaId}
      data-yomi-cover-preferred={preferred ? "true" : undefined}
      style={active ? { viewTransitionName: coverTransitionName(mangaId) } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
