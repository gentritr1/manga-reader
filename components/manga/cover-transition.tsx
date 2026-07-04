/// <reference types="react/canary" />

"use client";

import Link from "next/link";
import {
  ViewTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

type CoverTransitionLinkProps = ComponentProps<typeof Link> & {
  mangaId: string;
};

export function coverTransitionName(mangaId: string) {
  return `cover-${mangaId}`;
}

export function CoverTransitionLink({
  mangaId,
  ...props
}: CoverTransitionLinkProps) {
  void mangaId;

  return <Link {...props} />;
}

export function CoverTransitionElement({
  mangaId,
  enabled = true,
  className,
  children,
}: {
  mangaId: string;
  active?: boolean;
  enabled?: boolean;
  preferred?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cover = <div className={className}>{children}</div>;

  if (!enabled) {
    return cover;
  }

  return (
    <ViewTransition name={coverTransitionName(mangaId)} share="morph">
      {cover}
    </ViewTransition>
  );
}
