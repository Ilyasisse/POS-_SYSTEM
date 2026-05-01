"use client";

import { useEffect, type DependencyList } from "react";

const aosOptions = {
  duration: 450,
  easing: "ease-out-cubic",
  once: true,
  offset: 64,
};

let initialized = false;

function scheduleAfterHydration(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let firstFrame = 0;
  let secondFrame = 0;

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(callback);
  });

  return () => {
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
  };
}

export function useAos(dependencies: DependencyList = []) {
  useEffect(() => {
    let cancelled = false;

    const cancelSchedule = scheduleAfterHydration(async () => {
      const { default: AOS } = await import("aos");

      if (cancelled) {
        return;
      }

      if (!initialized) {
        AOS.init(aosOptions);
        initialized = true;
        return;
      }

      AOS.refreshHard();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
    };
    // Dependencies are supplied by each page using this shared AOS refresh hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

export default function AosInitializer() {
  useAos();

  return null;
}
