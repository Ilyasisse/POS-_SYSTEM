import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalLabel: string;
  baseQuery?: string;
};

/**
 * Renders previous and next pagination controls with a total result label.
 *
 * @param props - Admin pagination options.
 * @param props.currentPage - The currently selected page number.
 * @param props.totalPages - The total number of available pages.
 * @param props.totalLabel - The text label describing the total result count.
 * @param props.baseQuery - Optional existing query string used before adding the page value.
 * @returns The rendered admin pagination controls.
 *
 * @remarks Used by the categories, modifiers, and products admin pages.
 */
export function AdminPagination({
  currentPage,
  totalPages,
  totalLabel,
  baseQuery = "",
}: AdminPaginationProps) {
  const prefix = baseQuery ? `${baseQuery}&` : "?";

  return (
    <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium">{totalLabel}</p>
      <div className="flex items-center gap-2">
        <Link
          href={`${prefix}page=${Math.max(currentPage - 1, 1)}`}
          className={`grid size-8 place-items-center rounded-lg border border-slate-200 ${
            currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"
          }`}
          aria-label="Previous page"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
        </Link>
        <span className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700">
          {currentPage}
        </span>
        <Link
          href={`${prefix}page=${Math.min(currentPage + 1, totalPages)}`}
          className={`grid size-8 place-items-center rounded-lg border border-slate-200 ${
            currentPage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"
          }`}
          aria-label="Next page"
        >
          <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
        </Link>
      </div>
    </div>
  );
}
