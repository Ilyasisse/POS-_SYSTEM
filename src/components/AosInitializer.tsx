"use client";

import { useEffect } from "react";

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

export function useAos(
  dependencyA?: unknown,
  dependencyB?: unknown,
  dependencyC?: unknown,
  dependencyD?: unknown,
  dependencyE?: unknown,
  dependencyF?: unknown,
) {
  // Keep each caller trigger explicit so React can verify AOS refresh timing.
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
  }, [dependencyA, dependencyB, dependencyC, dependencyD, dependencyE, dependencyF]);
}

