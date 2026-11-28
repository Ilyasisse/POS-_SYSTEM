import {
  THERMAL_PAGE_HEIGHT_MM,
  THERMAL_PAGE_MARGIN_MM,
} from "./receipt-print-config";

// Chromium otherwise pushes an oversized keep-together block to a fresh page
// before splitting it. Measure in print media (beforeprint) to avoid that gap.
export function prepareThermalReceiptForPrint() {
  const printableHeight =
    ((THERMAL_PAGE_HEIGHT_MM - 2 * THERMAL_PAGE_MARGIN_MM) * 96) / 25.4;
  const groups = document.querySelectorAll<HTMLElement>(
    ".thermal-receipt :is(.thermal-item, .thermal-totals, .thermal-payment, .thermal-header, .thermal-details, .thermal-footer, .thermal-note)",
  );
  const measured = Array.from(groups, (group) => ({
    group,
    oversized: group.getBoundingClientRect().height > printableHeight,
  }));
  measured.forEach(({ group, oversized }) => {
    group.classList.toggle("thermal-can-split", oversized);
  });
}
