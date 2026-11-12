"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";
import {
  catalogFormValues,
  catalogLabels,
  catalogSchemas,
  fieldErrors,
  priceLabel,
  saleAvailable,
  selectionRule,
  stationLabels,
  stations,
  type CatalogData,
  type CatalogRecord,
  type CatalogResult,
} from "@/lib/catalog/catalog";
import { saveCatalogItem } from "@/app/admin/(catalog)/actions";

export function Field({
  name,
  label,
  errors,
  children,
}: {
  name: string;
  label: string;
  errors: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={`catalog-${name}`}
        className="block text-sm font-semibold"
      >
        {label}
      </label>
      {children}
      {errors[name] && (
        <p
          id={`error-${name}`}
          role="alert"
          className="text-sm text-destructive"
        >
          {errors[name]}
        </p>
      )}
    </div>
  );
}

export default function CatalogEditor({
  data,
  onClose,
  onDelete,
}: {
  data: CatalogData;
  onClose: () => void;
  onDelete: (row: CatalogRecord) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const pendingChanged = useCallback((value: boolean) => {
    pendingRef.current = value;
    setPending(value);
  }, []);
  const editor = data.editor;
  const record = editor && editor !== "new" ? editor : undefined;
  const title = `${record ? "Edit" : "Create"} ${catalogLabels[data.kind].singular}`;
  function changed(value: boolean) {
    dirtyRef.current = value;
    setDirty(value);
  }
  function close() {
    if (pending) return;
    if (!dirtyRef.current || window.confirm("Discard your unsaved changes?")) {
      changed(false);
      onClose();
    }
  }
  useEffect(() => {
    const href = window.location.href;
    let restoring = false;
    function unload(event: BeforeUnloadEvent) {
      if (dirtyRef.current || pendingRef.current) event.preventDefault();
    }
    function navigate(event: MouseEvent) {
      const anchor = (event.target as Element).closest("a[href]");
      if (anchor && pendingRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (
        !anchor ||
        !dirtyRef.current ||
        (anchor as HTMLAnchorElement).href === window.location.href
      )
        return;
      if (!window.confirm("Discard your unsaved changes?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else changed(false);
    }
    function back(event: PopStateEvent) {
      if (restoring) {
        restoring = false;
        return;
      }
      if (
        window.location.href === href ||
        (!dirtyRef.current && !pendingRef.current)
      )
        return;
      if (pendingRef.current) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.forward();
        return;
      }
      if (!window.confirm("Discard your unsaved changes?")) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.forward();
      } else changed(false);
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    window.addEventListener("popstate", back, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
      window.removeEventListener("popstate", back, true);
    };
  }, []);
  if (!editor) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none md:left-auto md:right-0 md:w-[36rem] md:rounded-l-2xl data-[state=open]:animate-none data-[state=closed]:animate-none"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          close();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b p-5">
          <div>
            <DialogTitle className="text-xl font-bold capitalize">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {record?.name ?? "Add a new item to your catalog."}
              {dirty ? " · Unsaved changes" : ""}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={close}
            disabled={pending}
          >
            Close
          </Button>
        </header>
        <CatalogForm
          key={`${data.kind}-${record?.id ?? "new"}-${record?.updatedAt ?? ""}`}
          data={data}
          formRef={formRef}
          onDirty={() => changed(true)}
          onPending={pendingChanged}
          onSaved={() => {
            changed(false);
            onClose();
          }}
          onCancel={close}
          onDelete={record ? () => onDelete(record) : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}

function CatalogForm({
  data,
  formRef,
  onDirty,
  onPending,
  onSaved,
  onCancel,
  onDelete,
}: {
  data: CatalogData;
  formRef: React.RefObject<HTMLFormElement | null>;
  onDirty: () => void;
  onPending: (value: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const row = data.editor && data.editor !== "new" ? data.editor : undefined;
  const { kind } = data;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [audioBusy, setAudioBusy] = useState(false);
  const [available, setAvailable] = useState(row ? saleAvailable(row) : true);
  const [required, setRequired] = useState(row?.isRequired ?? false);
  const [minimum, setMinimum] = useState(String(row?.minSelect ?? 0));
  const [maximum, setMaximum] = useState(String(row?.maxSelect ?? 1));
  const { toast } = useToast();
  const audioBusyChanged = useCallback(
    (busy: boolean) => {
      setAudioBusy(busy);
      onPending(busy);
    },
    [onPending],
  );
  const inputProps = (name: string) => ({
    id: `catalog-${name}`,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `error-${name}` : undefined,
    className: "min-h-11 w-full [&_select]:min-h-11",
  });
  const checkbox = (name: string, label: string, checked = true) => (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="size-5 accent-primary"
      />
      {label}
    </label>
  );
  const selectOptions = (values: { id: string; name: string }[]) => (
    <>
      <option value="">Select an item</option>
      {values.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </>
  );
  function report(result: Extract<CatalogResult, { ok: false }>) {
    setErrors(result.errors ?? {});
    setMessage(result.message);
    toast({ tone: "error", description: result.message });
    const name = Object.keys(result.errors ?? {})[0];
    requestAnimationFrame(() =>
      document.getElementById(`catalog-${name}`)?.focus(),
    );
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || audioBusy) return;
    const formData = new FormData(event.currentTarget);
    const parsed = catalogSchemas[kind].safeParse(catalogFormValues(formData));
    if (!parsed.success) {
      report({
        ok: false,
        message: "Check the highlighted fields.",
        errors: fieldErrors(parsed.error),
      });
      return;
    }
    onPending(true);
    setMessage("");
    setErrors({});
    startTransition(async () => {
      try {
        const result = await saveCatalogItem(kind, formData);
        if (result.ok) {
          toast({ tone: "success", description: result.message });
          onSaved();
        } else report(result);
      } catch {
        report({
          ok: false,
          message: "Could not save. Check your connection and try again.",
        });
      } finally {
        onPending(false);
      }
    });
  }
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      onChange={onDirty}
      className="flex min-h-0 flex-1 flex-col"
    >
      <fieldset
        disabled={pending}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
      >
        {row && (
          <>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="updatedAt" value={row.updatedAt} />
          </>
        )}
        <Field name="name" label="Name" errors={errors}>
          <Input
            {...inputProps("name")}
            defaultValue={row?.name ?? ""}
            maxLength={120}
            autoComplete="off"
          />
        </Field>
        {(kind === "products" || kind === "modifiers") && (
          <Field
            name="price"
            label={kind === "products" ? "Price ($)" : "Additional price ($)"}
            errors={errors}
          >
            <Input
              {...inputProps("price")}
              type="number"
              min="0"
              step="0.01"
              defaultValue={row?.price ?? (kind === "modifiers" ? 0 : "")}
            />
            <p className="text-xs text-muted-foreground">
              {kind === "modifiers"
                ? "A zero price is shown as Included."
                : "Stock quantities are managed in Inventory."}
            </p>
          </Field>
        )}
        {kind === "products" && (
          <>
            <Field name="categoryId" label="Category" errors={errors}>
              <NativeSelect
                {...inputProps("categoryId")}
                defaultValue={row?.categoryId ?? ""}
              >
                {selectOptions(data.categories)}
              </NativeSelect>
            </Field>
            <Field name="description" label="Description" errors={errors}>
              <Textarea
                {...inputProps("description")}
                defaultValue={row?.description ?? ""}
                maxLength={2000}
              />
            </Field>
            <Field name="imageUrl" label="Image URL" errors={errors}>
              <Input
                {...inputProps("imageUrl")}
                defaultValue={row?.imageUrl ?? ""}
                placeholder="https://… or /uploads/…"
              />
            </Field>
            {checkbox("isPopular", "Featured product", row?.isPopular ?? false)}
            {checkbox("trackStock", "Track stock", row?.trackStock ?? false)}
            <section className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <h3 className="font-semibold">Sale availability</h3>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  className="size-5 accent-primary"
                  type="checkbox"
                  name="availableForSale"
                  checked={available}
                  onChange={(event) => setAvailable(event.target.checked)}
                />
                Available for sale
              </label>
              {!available ? (
                <>
                  <Field
                    name="availabilityReason"
                    label="Reason for pausing sales"
                    errors={errors}
                  >
                    <Textarea
                      {...inputProps("availabilityReason")}
                      defaultValue={row?.availabilityReason ?? ""}
                      maxLength={200}
                    />
                  </Field>
                  <Field
                    name="durationMinutes"
                    label="Resume sales"
                    errors={errors}
                  >
                    <NativeSelect
                      {...inputProps("durationMinutes")}
                      defaultValue={row && !saleAvailable(row) ? "keep" : ""}
                    >
                      {row && !saleAvailable(row) && (
                        <option value="keep">Keep current schedule</option>
                      )}
                      <option value="">Manually</option>
                      <option value="60">After 1 hour</option>
                      <option value="180">After 3 hours</option>
                      <option value="720">After 12 hours</option>
                      <option value="1440">After 24 hours</option>
                    </NativeSelect>
                  </Field>
                  {row?.availabilityRestoresAt && (
                    <p className="text-xs text-muted-foreground">
                      Current schedule:{" "}
                      {new Date(row.availabilityRestoresAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <input type="hidden" name="availabilityReason" value="" />
                  <input type="hidden" name="durationMinutes" value="" />
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Resuming sales leaves stock unchanged. Inactive products and
                products in inactive categories stay hidden.
              </p>
            </section>
          </>
        )}
        {kind === "categories" && (
          <>
            <Field name="station" label="Kitchen station" errors={errors}>
              <NativeSelect
                {...inputProps("station")}
                defaultValue={row?.station ?? ""}
              >
                <option value="">No station</option>
                {stations.map((station) => (
                  <option key={station} value={station}>
                    {stationLabels[station]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              name="sortOrder"
              label="Menu position (starts at 0)"
              errors={errors}
            >
              <Input
                {...inputProps("sortOrder")}
                type="number"
                min="0"
                step="1"
                defaultValue={row?.sortOrder ?? data.ordering.length}
              />
              <p className="text-xs text-muted-foreground">
                Use Reorder categories in the list to arrange the whole menu.
              </p>
            </Field>
            {row && (
              <a
                href={`/admin/products?category=${encodeURIComponent(row.id)}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline"
              >
                View {row.productCount ?? 0} products
              </a>
            )}
          </>
        )}
        {kind === "modifiers" && (
          <>
            <Field
              name="productIds"
              label={row ? "Product" : "Products"}
              errors={errors}
            >
              {row ? (
                <NativeSelect
                  {...inputProps("productIds")}
                  defaultValue={row.productId}
                >
                  {selectOptions(data.products)}
                </NativeSelect>
              ) : (
                <div
                  id="catalog-productIds"
                  tabIndex={-1}
                  aria-describedby={
                    errors.productIds ? "error-productIds" : undefined
                  }
                  className="max-h-64 overflow-y-auto rounded-lg border p-2"
                >
                  {data.products.length ? (
                    data.products.map((product) => (
                      <label
                        key={product.id}
                        className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          name="productIds"
                          value={product.id}
                        />
                        {product.name}
                      </label>
                    ))
                  ) : (
                    <p className="p-3 text-sm">Create a product first.</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {!row &&
                  "Creates a separate option for every selected product."}
              </p>
            </Field>
            <Field
              name="modifierGroupId"
              label="Modifier group"
              errors={errors}
            >
              <NativeSelect
                {...inputProps("modifierGroupId")}
                defaultValue={row?.modifierGroupId ?? ""}
              >
                {selectOptions(data.groups)}
              </NativeSelect>
            </Field>
          </>
        )}
        {kind === "modifier-groups" && (
          <>
            <Field
              name="isRequired"
              label="Selection requirement"
              errors={errors}
            >
              <NativeSelect
                {...inputProps("isRequired")}
                value={required ? "on" : "off"}
                onChange={(event) => {
                  const next = event.target.value === "on";
                  setRequired(next);
                  setMinimum(next ? String(Math.max(1, Number(minimum))) : "0");
                }}
              >
                <option value="off">Optional</option>
                <option value="on">Required</option>
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field name="minSelect" label="Minimum choices" errors={errors}>
                <Input
                  {...inputProps("minSelect")}
                  type="number"
                  min="0"
                  step="1"
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                />
              </Field>
              <Field name="maxSelect" label="Maximum choices" errors={errors}>
                <Input
                  {...inputProps("maxSelect")}
                  type="number"
                  min="1"
                  step="1"
                  value={maximum}
                  onChange={(event) => setMaximum(event.target.value)}
                />
              </Field>
            </div>
            <p className="rounded-lg bg-muted p-3 text-sm font-medium">
              {selectionRule(Number(minimum), Number(maximum))}
            </p>
            <GroupPreview
              key={row?.id ?? "new"}
              row={row}
              minimum={Number(minimum)}
              maximum={Number(maximum)}
            />
          </>
        )}
        {checkbox(
          "isActive",
          kind === "products" ? "Active on menu" : "Active",
          row?.isActive ?? true,
        )}
        {(kind === "products" || kind === "modifiers") && (
          <PronunciationRecorder
            inputName="pronunciationAudioUrl"
            entityType={kind === "products" ? "product" : "modifier"}
            label={row?.name ?? catalogLabels[kind].singular}
            currentUrl={row?.pronunciationAudioUrl}
            onAudioChange={onDirty}
            onBusyChange={audioBusyChanged}
          />
        )}
        {message && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {message}
          </p>
        )}
      </fieldset>
      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-destructive"
            disabled={pending || audioBusy}
            onClick={onDelete}
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="ml-auto min-h-11"
          disabled={pending || audioBusy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="min-h-11"
          disabled={pending || audioBusy}
        >
          {pending
            ? "Saving…"
            : audioBusy
              ? "Recording audio…"
              : "Save changes"}
        </Button>
      </footer>
    </form>
  );
}

function GroupPreview({
  row,
  minimum,
  maximum,
}: {
  row?: CatalogRecord;
  minimum: number;
  maximum: number;
}) {
  const products = [
    ...new Map(
      (row?.options ?? []).map((option) => [
        option.productId,
        option.productName,
      ]),
    ).entries(),
  ];
  const [productId, setProductId] = useState(products[0]?.[0] ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const options = (row?.options ?? []).filter(
    (option) => option.productId === productId,
  );
  const active = options.filter((option) => option.isActive);
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Linked options & customer preview</h3>
      {products.length ? (
        <>
          <label htmlFor="preview-product" className="block text-sm">
            Preview for product
          </label>
          <NativeSelect
            id="preview-product"
            className="min-h-11 w-full [&_select]:min-h-11"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setSelected([]);
            }}
          >
            {products.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {row?.isActive
              ? "Only active choices for this product appear to customers."
              : "This group is inactive and hidden from customers."}
          </p>
          <div className="space-y-1">
            {options.map((option) => (
              <div
                key={option.id}
                className="flex min-h-11 items-center justify-between gap-2 border-b text-sm"
              >
                <span>
                  {option.name}
                  {!option.isActive && " · Inactive"}
                </span>
                <span>{priceLabel(option.price)}</span>
              </div>
            ))}
          </div>
          <fieldset className="space-y-2 rounded-lg bg-muted/40 p-3">
            <legend className="text-sm font-medium">
              {selectionRule(minimum, maximum)}
            </legend>
            {active.map((option) => (
              <label
                key={option.id}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type={maximum === 1 ? "radio" : "checkbox"}
                  name="customer-preview-choice"
                  className="size-5 accent-primary"
                  checked={selected.includes(option.id)}
                  disabled={
                    maximum !== 1 &&
                    selected.length >= maximum &&
                    !selected.includes(option.id)
                  }
                  onChange={() =>
                    setSelected((current) =>
                      maximum === 1
                        ? [option.id]
                        : current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id],
                    )
                  }
                />
                {option.name}
                <span className="ml-auto">{priceLabel(option.price)}</span>
              </label>
            ))}
            {active.length < minimum && (
              <p className="text-sm text-destructive">
                This product needs more active options to meet the minimum.
              </p>
            )}
          </fieldset>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No linked options. Create modifiers for this group and choose their
          products.
        </p>
      )}
    </section>
  );
}
