"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { changeCatalogStatus } from "@/app/admin/(catalog)/actions";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import {
  catalogKinds,
  catalogLabels,
  priceLabel,
  saleAvailable,
  selectionRule,
  stationLabels,
  type CatalogData,
  type CatalogKind,
  type CatalogRecord,
} from "@/lib/catalog/catalog";
import CatalogEditor from "./CatalogEditor";
import CatalogMenus from "./CatalogMenus";
import CategoryReorder from "./CategoryReorder";
import {
  CatalogAvailabilityDialog,
  CatalogDeleteDialog,
} from "./CatalogRowDialogs";

export default function CatalogWorkspace({ data }: { data: CatalogData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<CatalogRecord | null>(null);
  const [availability, setAvailability] = useState<CatalogRecord | null>(null);
  const [ordering, setOrdering] = useState(false);
  const { kind } = data;
  const labels = catalogLabels[kind];
  const base = `/admin/${kind}`;
  const params = new URLSearchParams(data.params);
  params.delete("edit");
  const listHref = `${base}${params.size ? `?${params}` : ""}`;
  const hrefWith = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    return `${base}?${next}`;
  };
  function navigate(href: string, replace = false) {
    startTransition(() =>
      replace
        ? router.replace(href, { scroll: false })
        : router.push(href, { scroll: false }),
    );
  }
  function closeEditor() {
    navigate(listHref, true);
  }
  function filter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      const text = String(value).trim();
      if (text && text !== "all") next.set(key, text);
    });
    navigate(`${base}${next.size ? `?${next}` : ""}`);
  }
  const filterActive = Object.entries(data.params).some(
    ([key, value]) =>
      !["edit", "page"].includes(key) && value && value !== "all",
  );
  const rowMenu = (row: CatalogRecord) => (
    <CatalogMenus
      row={row}
      product={kind === "products"}
      onEdit={() => navigate(hrefWith("edit", row.id))}
      onStatus={() =>
        startTransition(async () => {
          const form = new FormData();
          form.set("id", row.id);
          form.set("updatedAt", row.updatedAt);
          form.set("isActive", row.isActive ? "off" : "on");
          try {
            const result = await changeCatalogStatus(kind, form);
            toast({
              tone: result.ok ? "success" : "error",
              description: result.message,
            });
            if (result.ok) router.refresh();
          } catch {
            toast({
              tone: "error",
              description: "Could not update status. Please try again.",
            });
          }
        })
      }
      onDelete={() => setDeleting(row)}
      onAvailability={() => setAvailability(row)}
    />
  );
  const editLink = (row: CatalogRecord, children?: React.ReactNode) => (
    <Link
      prefetch={false}
      scroll={false}
      href={hrefWith("edit", row.id)}
      className="break-words font-semibold text-foreground underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children ?? row.name}
    </Link>
  );
  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:p-8"
      aria-busy={pending}
    >
      <CatalogNavigation current={kind} />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Menu catalog
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {labels.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {labels.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "categories" && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={data.ordering.length < 2 || pending}
              onClick={() => setOrdering(true)}
            >
              <ArrowDownUp aria-hidden="true" className="size-4" />
              Reorder categories
            </Button>
          )}
          <Button
            className="min-h-11 capitalize"
            disabled={pending}
            onClick={() => navigate(hrefWith("edit", "new"))}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add {labels.singular}
          </Button>
        </div>
      </header>
      <section
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        aria-label={`${labels.title} list`}
      >
        <form
          key={`${kind}-${JSON.stringify(data.params)}`}
          onSubmit={filter}
          className="flex flex-wrap items-end gap-3 border-b p-4"
          role="search"
          aria-label={`Filter ${labels.title.toLowerCase()}`}
        >
          <div className="min-w-0 flex-1 basis-52">
            <label
              htmlFor="catalog-search"
              className="mb-2 block text-xs font-semibold text-muted-foreground"
            >
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="catalog-search"
                name="q"
                type="search"
                maxLength={200}
                defaultValue={data.params.q ?? ""}
                placeholder={`Search ${labels.title.toLowerCase()}…`}
                className="min-h-11 pl-9"
              />
            </div>
          </div>
          {kind === "products" && (
            <FilterSelect
              name="category"
              label="Category"
              value={data.params.category}
            >
              <option value="all">All categories</option>
              {data.categories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </FilterSelect>
          )}
          {kind === "categories" && (
            <FilterSelect
              name="station"
              label="Kitchen station"
              value={data.params.station}
            >
              <option value="all">All stations</option>
              {Object.entries(stationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FilterSelect>
          )}
          {kind === "modifiers" && (
            <>
              <FilterSelect
                name="product"
                label="Product"
                value={data.params.product}
              >
                <option value="all">All products</option>
                {data.products.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                name="group"
                label="Group"
                value={data.params.group}
              >
                <option value="all">All groups</option>
                {data.groups.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </FilterSelect>
            </>
          )}
          <FilterSelect
            name="status"
            label={kind === "products" ? "Menu status" : "Status"}
            value={data.params.status}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            {kind === "products" && (
              <option value="hidden">Hidden by category</option>
            )}
          </FilterSelect>
          {kind === "products" && (
            <FilterSelect
              name="availability"
              label="Sale availability"
              value={data.params.availability}
            >
              <option value="all">All availability</option>
              <option value="available">For sale</option>
              <option value="sold-out">Sold out</option>
            </FilterSelect>
          )}
          <Button
            type="submit"
            variant="outline"
            className="min-h-11"
            disabled={pending}
          >
            Apply filters
          </Button>
          {filterActive && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={pending}
              onClick={() => navigate(base)}
            >
              Clear
            </Button>
          )}
        </form>
        {data.rows.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/35 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      {kind === "products"
                        ? "Product"
                        : kind === "modifier-groups"
                          ? "Group"
                          : "Name"}
                    </th>
                    {kind === "products" ? (
                      <>
                        <Column>Price</Column>
                        <Column>Menu status</Column>
                        <Column>Sale availability</Column>
                        <Column>Stock</Column>
                      </>
                    ) : kind === "categories" ? (
                      <>
                        <Column>Kitchen station</Column>
                        <Column>Menu position</Column>
                        <Column>Status</Column>
                        <Column>Products</Column>
                      </>
                    ) : kind === "modifiers" ? (
                      <>
                        <Column>Product / group</Column>
                        <Column>Additional price</Column>
                        <Column>Status</Column>
                      </>
                    ) : (
                      <>
                        <Column>Selection rules</Column>
                        <Column>Linked options</Column>
                        <Column>Status</Column>
                      </>
                    )}
                    <th scope="col" className="w-16 px-3 py-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/15">
                      <td className="max-w-80 px-5 py-4">
                        {kind === "products" ? (
                          <ProductName row={row}>{editLink(row)}</ProductName>
                        ) : (
                          <div>
                            {editLink(row)}
                            {kind === "modifiers" &&
                              row.pronunciationAudioUrl && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Pronunciation saved
                                </p>
                              )}
                          </div>
                        )}
                      </td>
                      {kind === "products" ? (
                        <>
                          <Cell>
                            <span className="font-semibold tabular-nums">
                              ${(row.price ?? 0).toFixed(2)}
                            </span>
                          </Cell>
                          <Cell>
                            <MenuStatus row={row} />
                          </Cell>
                          <Cell>
                            <SaleStatus row={row} />
                          </Cell>
                          <Cell>
                            <Stock row={row} />
                          </Cell>
                        </>
                      ) : kind === "categories" ? (
                        <>
                          <Cell>
                            {row.station
                              ? (stationLabels[row.station] ?? row.station)
                              : "No station"}
                          </Cell>
                          <Cell>
                            <span className="tabular-nums">
                              {(row.sortOrder ?? 0) + 1}
                            </span>
                          </Cell>
                          <Cell>
                            <ActiveStatus row={row} />
                          </Cell>
                          <Cell>
                            <ProductCount row={row} />
                          </Cell>
                        </>
                      ) : kind === "modifiers" ? (
                        <>
                          <Cell>
                            <p className="font-medium">{row.productName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.groupName}
                            </p>
                          </Cell>
                          <Cell>{priceLabel(row.price)}</Cell>
                          <Cell>
                            <ActiveStatus row={row} />
                          </Cell>
                        </>
                      ) : (
                        <>
                          <Cell>
                            <p>{selectionRule(row.minSelect, row.maxSelect)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.isRequired ? "Required" : "Optional"}
                            </p>
                          </Cell>
                          <Cell>
                            <LinkedCount row={row} />
                          </Cell>
                          <Cell>
                            <ActiveStatus row={row} />
                          </Cell>
                        </>
                      )}
                      <td className="px-3 py-4">{rowMenu(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y lg:hidden">
              {data.rows.map((row) => (
                <article
                  key={row.id}
                  className="space-y-4 p-4"
                  aria-label={row.name}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {kind === "products" ? (
                        <ProductName row={row}>{editLink(row)}</ProductName>
                      ) : (
                        <div className="pt-2">{editLink(row)}</div>
                      )}
                    </div>
                    {rowMenu(row)}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {kind === "products" ? (
                      <>
                        <Detail label="Price">
                          <span className="font-semibold tabular-nums">
                            ${(row.price ?? 0).toFixed(2)}
                          </span>
                        </Detail>
                        <Detail label="Menu status">
                          <MenuStatus row={row} />
                        </Detail>
                        <Detail label="Sale availability">
                          <SaleStatus row={row} />
                        </Detail>
                        <Detail label="Stock">
                          <Stock row={row} />
                        </Detail>
                      </>
                    ) : kind === "categories" ? (
                      <>
                        <Detail label="Kitchen station">
                          {row.station
                            ? (stationLabels[row.station] ?? row.station)
                            : "No station"}
                        </Detail>
                        <Detail label="Menu position">
                          {(row.sortOrder ?? 0) + 1}
                        </Detail>
                        <Detail label="Status">
                          <ActiveStatus row={row} />
                        </Detail>
                        <Detail label="Products">
                          <ProductCount row={row} />
                        </Detail>
                      </>
                    ) : kind === "modifiers" ? (
                      <>
                        <Detail label="Product">{row.productName}</Detail>
                        <Detail label="Group">{row.groupName}</Detail>
                        <Detail label="Additional price">
                          {priceLabel(row.price)}
                        </Detail>
                        <Detail label="Status">
                          <ActiveStatus row={row} />
                        </Detail>
                      </>
                    ) : (
                      <>
                        <Detail label="Selection rules">
                          {selectionRule(row.minSelect, row.maxSelect)}
                        </Detail>
                        <Detail label="Requirement">
                          {row.isRequired ? "Required" : "Optional"}
                        </Detail>
                        <Detail label="Linked options">
                          <LinkedCount row={row} />
                        </Detail>
                        <Detail label="Status">
                          <ActiveStatus row={row} />
                        </Detail>
                      </>
                    )}
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3 px-5 py-16 text-center">
            <Package
              className="mx-auto size-9 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="font-semibold">
              No {labels.title.toLowerCase()} found
            </p>
            <p className="text-sm text-muted-foreground">
              {filterActive
                ? "Try another search or clear the filters."
                : `Add your first ${labels.singular} to get started.`}
            </p>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {data.total
              ? `${(data.page - 1) * 10 + 1}–${Math.min(data.page * 10, data.total)} of ${data.total}`
              : "0 items"}
          </p>
          <nav
            aria-label="Catalog pagination"
            className="flex items-center gap-2"
          >
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Previous page"
              disabled={data.page <= 1 || pending}
              onClick={() => navigate(hrefWith("page", String(data.page - 1)))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-sm tabular-nums">
              Page {data.page} of {data.pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Next page"
              disabled={data.page >= data.pages || pending}
              onClick={() => navigate(hrefWith("page", String(data.page + 1)))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </nav>
        </footer>
      </section>
      {data.editor && (
        <CatalogEditor
          key={`${kind}-${typeof data.editor === "string" ? data.editor : data.editor.id}`}
          data={data}
          onClose={closeEditor}
          onDelete={setDeleting}
        />
      )}
      {deleting && (
        <CatalogDeleteDialog
          kind={kind}
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            if (data.editor) closeEditor();
            router.refresh();
          }}
        />
      )}
      {availability && (
        <CatalogAvailabilityDialog
          row={availability}
          onClose={() => setAvailability(null)}
        />
      )}
      {ordering && (
        <CategoryReorder data={data} onClose={() => setOrdering(false)} />
      )}
    </main>
  );
}

function CatalogNavigation({ current }: { current: CatalogKind }) {
  const router = useRouter();
  return (
    <nav aria-label="Catalog sections">
      <div className="hidden flex-wrap gap-1 rounded-xl border bg-card p-1 md:flex">
        {catalogKinds.map((kind) => (
          <Link
            key={kind}
            prefetch={false}
            href={`/admin/${kind}`}
            aria-current={current === kind ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-5 text-sm font-semibold transition-colors ${current === kind ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {catalogLabels[kind].title}
          </Link>
        ))}
      </div>
      <div className="md:hidden">
        <label
          htmlFor="catalog-section"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Catalog section
        </label>
        <NativeSelect
          id="catalog-section"
          className="w-full [&_select]:min-h-12 [&_select]:font-semibold"
          value={current}
          onChange={(event) => router.push(`/admin/${event.target.value}`)}
        >
          {catalogKinds.map((kind) => (
            <option key={kind} value={kind}>
              {catalogLabels[kind].title}
            </option>
          ))}
        </NativeSelect>
      </div>
    </nav>
  );
}
function FilterSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 basis-36 lg:max-w-48">
      <label
        htmlFor={`filter-${name}`}
        className="mb-2 block text-xs font-semibold text-muted-foreground"
      >
        {label}
      </label>
      <NativeSelect
        id={`filter-${name}`}
        name={name}
        defaultValue={value ?? "all"}
        className="w-full min-w-0 [&_select]:min-h-11"
      >
        {children}
      </NativeSelect>
    </div>
  );
}
function Column({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-4 font-semibold">
      {children}
    </th>
  );
}
function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 align-middle">{children}</td>;
}
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
function ActiveStatus({ row }: { row: CatalogRecord }) {
  return (
    <Badge variant={row.isActive ? "secondary" : "outline"}>
      {row.isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
function MenuStatus({ row }: { row: CatalogRecord }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ActiveStatus row={row} />
      {row.categoryActive === false && (
        <Badge variant="outline">Hidden by category</Badge>
      )}
    </div>
  );
}
function SaleStatus({ row }: { row: CatalogRecord }) {
  const available = saleAvailable(row);
  return (
    <div className="max-w-56 space-y-1">
      <Badge variant={available ? "secondary" : "destructive"}>
        {available ? "For sale" : "Sold out"}
      </Badge>
      {!available && (
        <p className="text-xs leading-5 text-muted-foreground">
          {row.availabilityReason || "Sales paused"}
          <br />
          {row.availabilityRestoresAt ? (
            <time
              dateTime={row.availabilityRestoresAt}
              suppressHydrationWarning
            >
              Until {new Date(row.availabilityRestoresAt).toLocaleString()}
            </time>
          ) : (
            "Resume manually"
          )}
        </p>
      )}
    </div>
  );
}
function Stock({ row }: { row: CatalogRecord }) {
  return (
    <span className="tabular-nums">
      {row.trackStock ? `${row.stockQty ?? 0} in stock` : "Not tracked"}
    </span>
  );
}
function ProductCount({ row }: { row: CatalogRecord }) {
  return (
    <Link
      prefetch={false}
      href={`/admin/products?category=${encodeURIComponent(row.id)}`}
      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      aria-label={`View ${row.productCount ?? 0} products in ${row.name}`}
    >
      {row.productCount ?? 0} products
    </Link>
  );
}
function LinkedCount({ row }: { row: CatalogRecord }) {
  const products = new Set(row.options?.map((option) => option.productId));
  return (
    <span>
      {row.options?.length ?? 0} options · {products.size} products
    </span>
  );
}
function ProductName({
  row,
  children,
}: {
  row: CatalogRecord;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.imageUrl ? (
        <Image
          src={row.imageUrl}
          unoptimized
          width={48}
          height={48}
          alt=""
          className="size-12 shrink-0 rounded-xl border bg-muted object-cover"
        />
      ) : (
        <span
          className="grid size-12 shrink-0 place-items-center rounded-xl border bg-muted text-lg font-semibold"
          aria-hidden="true"
        >
          {row.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="leading-5">{children}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.categoryName}</p>
      </div>
    </div>
  );
}
