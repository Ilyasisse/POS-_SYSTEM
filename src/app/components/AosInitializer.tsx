"use client";

import { useEffect, type DependencyList } from "react";

const aosOptions = {
  duration: 450,
  easing: "ease-out-cubic",
  once: true,
  offset: 120,
  anchorPlacement: "top-bottom",
};

let initialized = false;
let observedAosElements: Element[] = [];

function getAosElements() {
  return Array.from(document.querySelectorAll("[data-aos]"));
}

function hasSameAosElements(nextElements: Element[]) {
  return (
    observedAosElements.length === nextElements.length &&
    observedAosElements.every(
      (element, index) => element === nextElements[index],
    )
  );
}

function scheduleAfterLayoutSettles(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let firstFrame = 0;
  let secondFrame = 0;
  let settleTimer = 0;

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      settleTimer = window.setTimeout(callback, 80);
    });
  });

  return () => {
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
    window.clearTimeout(settleTimer);
  };
}

export function useAos(dependencies: DependencyList = []) {
  useEffect(() => {
    let cancelled = false;

    const cancelSchedule = scheduleAfterLayoutSettles(async () => {
      const { default: AOS } = await import("aos");

      if (cancelled) {
        return;
      }

      const currentAosElements = getAosElements();

      if (!initialized) {
        AOS.init(aosOptions);
        observedAosElements = currentAosElements;
        initialized = true;
        return;
      }

      if (hasSameAosElements(currentAosElements)) {
        AOS.refresh();
        return;
      }

      observedAosElements = currentAosElements;
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
