/// <reference types="react/canary" />

import { ViewTransition, type ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      default="page-fade"
      enter="page-fade"
      exit="page-fade"
      update="none"
    >
      {children}
    </ViewTransition>
  );
}
