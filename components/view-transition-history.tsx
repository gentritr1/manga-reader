"use client";

import { useEffect } from "react";

type ReactViewTransitionDocument = Document & {
  __reactViewTransition?: ViewTransition;
};

export function ViewTransitionHistoryBridge() {
  useEffect(() => {
    if (!document.startViewTransition) return;

    let currentPath = window.location.pathname;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    function rememberPath() {
      currentPath = window.location.pathname;
    }

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      rememberPath();
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      rememberPath();
      return result;
    };

    function isCoverBackNavigation(fromPath: string, toPath: string) {
      return (
        (fromPath.startsWith("/manga/") && toPath === "/") ||
        (fromPath === "/" && toPath.startsWith("/manga/"))
      );
    }

    function handlePopState() {
      const fromPath = currentPath;
      const toPath = window.location.pathname;
      currentPath = toPath;
      if (!isCoverBackNavigation(fromPath, toPath)) return;

      const transitionDocument = document as ReactViewTransitionDocument;
      if (transitionDocument.__reactViewTransition) return;

      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          }),
      );

      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
      transition.finished.catch(() => {});
    }

    window.addEventListener("popstate", handlePopState, { capture: true });
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState, { capture: true });
    };
  }, []);

  return null;
}
