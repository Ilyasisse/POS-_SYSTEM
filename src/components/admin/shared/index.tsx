import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export { Button, Card, NativeSelect, Table, TableCell, TableHead };

export function AdminPage({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Administration"
        title={title}
        description={description}
        actions={action}
      />
      {children}
    </div>
  );
}

export function DataTableCard({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {children}
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </Card>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper?: string;
}) {
  return (
    <Card className="gap-1 p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </Card>
  );
}

export function SearchToolbar({
  placeholder,
  defaultValue,
  children,
  hasActiveFilters = false,
  clearHref,
}: {
  placeholder: string;
  defaultValue?: string;
  children?: ReactNode;
  hasActiveFilters?: boolean;
  clearHref: string;
}) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center"
    >
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="pl-9"
        />
      </label>
      {children}
      <Button type="submit">Search</Button>
      <ClearFiltersLink href={clearHref} show={hasActiveFilters} />
    </form>
  );
}

export function ClearFiltersLink({
  href,
  show,
  label = "Clear filters",
}: {
  href: string;
  show: boolean;
  label?: string;
}) {
  if (!show) return null;

  return (
    <Button asChild variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild>
      <Link href={href}>
        <Plus data-icon="inline-start" />
        {children}
      </Link>
    </Button>
  );
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalLabel,
  baseQuery = "",
}: {
  currentPage: number;
  totalPages: number;
  totalLabel: string;
  baseQuery?: string;
}) {
  const prefix = baseQuery ? `${baseQuery}&` : "?";

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>{totalLabel}</p>
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="outline"
          size="icon"
          className={cn(currentPage <= 1 && "pointer-events-none opacity-40")}
        >
          <Link
            href={`${prefix}page=${Math.max(currentPage - 1, 1)}`}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Link>
        </Button>
        <Badge variant="outline" className="h-10 min-w-10 justify-center">
          {currentPage}
        </Badge>
        <Button
          asChild
          variant="outline"
          size="icon"
          className={cn(
            currentPage >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          <Link
            href={`${prefix}page=${Math.min(currentPage + 1, totalPages)}`}
            aria-label="Next page"
          >
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function RowActions({
  editHref,
  deleteLabel = "Delete",
}: {
  editHref: string;
  deleteLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Edit">
        <Link href={editHref}>
          <Pencil />
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={deleteLabel}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
}

export function StatusBadge({
  active,
  label,
}: {
  active: boolean;
  label?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        active
          ? "border-success/25 bg-success/10 text-success dark:text-success"
          : "border-destructive/25 bg-destructive/10 text-destructive",
      )}
    >
      {label ?? (active ? "Active" : "Inactive")}
    </Badge>
  );
}

export function ToneBadge({
  tone,
  children,
}: {
  tone: "green" | "red" | "amber" | "blue" | "slate";
  children: ReactNode;
}) {
  const classes = {
    green: "border-success/25 bg-success/10 text-success dark:text-success",
    red: "border-destructive/25 bg-destructive/10 text-destructive",
    amber:
      "border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning",
    blue: "border-info/25 bg-info/10 text-info dark:text-info",
    slate: "border-border bg-muted text-muted-foreground",
  }[tone];

  return (
    <Badge variant="outline" className={classes}>
      {children}
    </Badge>
  );
}
