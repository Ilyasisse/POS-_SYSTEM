"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";

import { formatCustomerMessage, type CustomerMessage } from "@/i18n/customer";
import { Button } from "@/components/ui/button";

import { NativeSelect } from "@/components/ui/native-select";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ModifierGroup, Product, SelectedModifierLine, StaffSummary } from "@/lib/types";
import {
  buildModifierLines,
  formatCurrency,
  getProductImage,
  getProductModifierGroups,
  type SelectedModifiersMap,
} from "./customer-order-utils";

type CustomerModifierModalProps = {
  open: boolean;
  product: Product | null;
  baristas: StaffSummary[];
  onClose: () => void;
  onConfirm: (
    product: Product,
    selectedModifiers: SelectedModifiersMap,
    assignedBaristaId: string | null,
  ) => void;
};

type ModifierErrors = Record<string, CustomerMessage>;

type CustomerModifierHeroProps = {
  product: Product;
  onClose: () => void;
};

type ModifierGroupListProps = {
  modifierGroups: ModifierGroup[];
  selected: SelectedModifiersMap;
  errors: ModifierErrors;
  onToggleOption: (group: ModifierGroup, optionId: string) => void;
};

type BaristaAssignmentProps = {
  baristas: StaffSummary[];
  selectedBaristaId: string;
  onSelectedBaristaIdChange: (baristaId: string) => void;
};

type ModifierModalFooterProps = {
  selectedLines: SelectedModifierLine[];
  previewTotal: number;
  disabled: boolean;
  onAddToCart: () => void;
};

type CustomerModifierContentProps = {
  product: Product;
  baristas: StaffSummary[];
  defaultBaristaId: string;
  onClose: () => void;
  onConfirm: CustomerModifierModalProps["onConfirm"];
};

function getMinSelect(group: ModifierGroup) {
  if (typeof group.minSelect === "number") {
    return group.minSelect;
  }

  return group.required ? 1 : 0;
}

function getMaxSelect(group: ModifierGroup) {
  if (typeof group.maxSelect === "number") {
    return group.maxSelect;
  }

  return group.multiple ? group.options.length : 1;
}

function getModifierSelectionErrors(
  modifierGroups: ModifierGroup[],
  selected: SelectedModifiersMap,
): ModifierErrors {
  return modifierGroups.reduce<ModifierErrors>((accumulator, group) => {
    const count = (selected[group.id] || []).length;
    const min = getMinSelect(group);
    const max = getMaxSelect(group);

    if (count < min) {
      accumulator[group.id] =
        min === 1 ? { key: "chooseOne" } : { key: "chooseMin", values: { count: min } };
    } else if (count > max) {
      accumulator[group.id] =
        max === 1 ? { key: "onlyOne" } : { key: "chooseMax", values: { count: max } };
    }

    return accumulator;
  }, {});
}

function CustomerModifierHero({ product, onClose }: CustomerModifierHeroProps) {
  const t = useCustomerTranslations();
  return (
    <div className="relative min-h-[18rem] overflow-hidden bg-stone-950 text-white md:min-h-[22rem] lg:h-full lg:min-h-[32rem] lg:self-stretch">
      <Image
        src={getProductImage(product)}
        alt={product.name}
        fill
        sizes="(min-width: 1024px) 45vw, 100vw"
        unoptimized
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,12,8,0.25)_0%,rgba(20,12,8,0.42)_28%,rgba(20,12,8,0.78)_70%,rgba(20,12,8,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.18),transparent_28%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-7">
          <div>
            <p className="text-xs tracking-[0.32em] text-amber-200/90 uppercase">
              {t("customizeItem")}
            </p>
            <h2
              className="mt-3 max-w-md text-3xl leading-tight break-words sm:text-4xl lg:text-5xl"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
              }}
            >
              {product.name}
            </h2>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 hover:text-white sm:px-4 dark:bg-white/10 dark:hover:bg-white/15"
          >
            {t("close")}
          </Button>
        </div>

        <div className="pt-30 pr-0.5 pl-5 text-right lg:mt-auto lg:flex lg:justify-end lg:p-7 lg:pt-32">
          <div className="rounded-[25px] border-white/10 bg-transparent p-4 sm:w-full sm:max-w-md sm:border sm:bg-black/20 sm:backdrop-blur-sm">
            <p className="hidden text-sm leading-6 break-words text-stone-100/80 sm:block">
              {product.description?.trim() || t("customizeFallback")}
            </p>
            <p className="mt-4 text-sm tracking-[0.22em] text-amber-100/70 uppercase">
              {t("basePrice")}
            </p>
            <p className="mt-1 text-3xl font-semibold text-amber-100">
              {formatCurrency(Number(product.price))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModifierGroupList({
  modifierGroups,
  selected,
  errors,
  onToggleOption,
}: ModifierGroupListProps) {
  const t = useCustomerTranslations();
  return (
    <>
      {modifierGroups.map((group, groupIndex) => {
        const selectedOptionIdSet = new Set(selected[group.id] || []);

        return (
          <section
            key={group.id}
            aria-labelledby={`modifier-group-${group.id}`}
            aria-describedby={`modifier-guidance-${group.id}`}
            data-aos="fade-up"
            data-aos-delay={String(groupIndex * 50)}
            className="border-border bg-card min-w-0 rounded-[1.5rem] border p-4 shadow-[0_18px_45px_rgba(50,35,24,0.06)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  id={`modifier-group-${group.id}`}
                  className="text-foreground text-lg font-semibold break-words"
                >
                  {group.name}
                </h3>
                <p
                  id={`modifier-guidance-${group.id}`}
                  className="text-muted-foreground mt-1 text-xs tracking-[0.2em] uppercase"
                >
                  {t("chooseRange", { min: getMinSelect(group), max: getMaxSelect(group) })}
                </p>
              </div>
              {errors[group.id] ? (
                <span
                  role="alert"
                  className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {formatCustomerMessage(errors[group.id], t)}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.options.map((option) => {
                const checked = selectedOptionIdSet.has(option.id);

                return (
                  <Button
                    variant="outline"
                    key={option.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => onToggleOption(group, option.id)}
                    className={`min-w-0 rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      checked
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-muted/50 hover:border-border hover:bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground font-semibold break-words">{option.name}</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {Number(option.price) > 0
                            ? `+${formatCurrency(Number(option.price))}`
                            : t("included")}
                        </p>
                      </div>
                      <span
                        className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold uppercase ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-transparent"
                        }`}
                      >
                        ok
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function BaristaAssignment({
  baristas,
  selectedBaristaId,
  onSelectedBaristaIdChange,
}: BaristaAssignmentProps) {
  const t = useCustomerTranslations();
  return (
    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-300">
            {t("baristaAssignment")}
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-300/80">{t("chooseBarista")}</p>
        </div>
        <NativeSelect
          value={selectedBaristaId}
          onChange={(event) => onSelectedBaristaIdChange(event.target.value)}
          className="bg-card text-foreground w-full rounded-full border border-amber-300 px-4 py-2 text-sm font-medium outline-none sm:w-auto dark:border-amber-800"
        >
          <option value="">{t("selectBarista")}</option>
          {baristas.map((barista) => (
            <option key={barista.id} value={barista.id}>
              {barista.fullName}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function ModifierModalFooter({
  selectedLines,
  previewTotal,
  disabled,
  onAddToCart,
}: ModifierModalFooterProps) {
  const t = useCustomerTranslations();
  return (
    <div className="border-border bg-card sticky bottom-0 z-10 border-t px-4 py-4 shadow-[0_-18px_45px_rgba(50,35,24,0.08)] sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            {t("selectedAddons")}
          </p>
          <p className="text-muted-foreground mt-2 max-h-16 overflow-y-auto text-sm break-words">
            {selectedLines.length === 0
              ? t("noSelections")
              : selectedLines.map((modifier) => modifier.optionName).join(", ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            {t("itemTotal")}
          </p>
          <p className="text-foreground mt-2 text-3xl font-semibold">
            {formatCurrency(previewTotal)}
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={onAddToCart}
        disabled={disabled}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 w-full rounded-full px-6 py-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("addToCart")}
      </Button>
    </div>
  );
}

function getDefaultBaristaId(product: Product, baristas: StaffSummary[]) {
  return product.category?.station === "BARISTA" ? (baristas[0]?.id ?? "") : "";
}

function CustomerModifierContent({
  product,
  baristas,
  defaultBaristaId,
  onClose,
  onConfirm,
}: CustomerModifierContentProps) {
  const t = useCustomerTranslations();
  const [selected, setSelected] = useState<SelectedModifiersMap>({});
  const [selectedBaristaId, setSelectedBaristaId] = useState(defaultBaristaId);

  const modifierGroups = useMemo(() => getProductModifierGroups(product), [product]);

  const selectedLines = useMemo(() => buildModifierLines(product, selected), [product, selected]);
  const previewTotal = useMemo(() => {
    return (
      Number(product.price) +
      selectedLines.reduce((sum, modifier) => sum + modifier.price * modifier.qty, 0)
    );
  }, [product, selectedLines]);

  const errors = useMemo(
    () => getModifierSelectionErrors(modifierGroups, selected),
    [modifierGroups, selected],
  );

  const hasBaristaRequirement = product.category?.station === "BARISTA" && !selectedBaristaId;
  const disabled = Object.keys(errors).length > 0 || hasBaristaRequirement;

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected((current) => {
      const existing = current[group.id] || [];
      const exists = existing.includes(optionId);
      const min = getMinSelect(group);
      const max = getMaxSelect(group);

      if (group.multiple) {
        if (exists) {
          if (existing.length <= min) {
            return current;
          }

          return {
            ...current,
            [group.id]: existing.filter((id) => id !== optionId),
          };
        }

        if (existing.length >= max) {
          return current;
        }

        return {
          ...current,
          [group.id]: [...existing, optionId],
        };
      }

      if (exists && min === 0) {
        return {
          ...current,
          [group.id]: [],
        };
      }

      if (exists) {
        return current;
      }

      return {
        ...current,
        [group.id]: [optionId],
      };
    });
  }

  return (
    <div className="grid flex-1 items-start lg:h-[min(90dvh,54rem)] lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-stretch lg:overflow-hidden">
      <CustomerModifierHero product={product} onClose={onClose} />

      <div className="bg-muted/50 flex min-h-0 min-w-0 flex-col">
        <div className="border-border hidden border-b px-4 py-4 sm:block sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase">
              {t("groups", { count: modifierGroups.length })}
            </span>
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-6">{t("customizeHelp")}</p>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
          <ModifierGroupList
            modifierGroups={modifierGroups}
            selected={selected}
            errors={errors}
            onToggleOption={toggleOption}
          />

          {product.category?.station === "BARISTA" ? (
            <BaristaAssignment
              baristas={baristas}
              selectedBaristaId={selectedBaristaId}
              onSelectedBaristaIdChange={setSelectedBaristaId}
            />
          ) : null}
        </div>

        <ModifierModalFooter
          selectedLines={selectedLines}
          previewTotal={previewTotal}
          disabled={disabled}
          onAddToCart={() => onConfirm(product, selected, selectedBaristaId || null)}
        />
      </div>
    </div>
  );
}

export default function CustomerModifierModal({
  open,
  product,
  baristas,
  onClose,
  onConfirm,
}: CustomerModifierModalProps) {
  const t = useCustomerTranslations();
  if (!product) {
    return null;
  }

  const defaultBaristaId = getDefaultBaristaId(product, baristas);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card text-foreground dark:bg-card dark:text-foreground max-h-[95dvh] w-[calc(100%-1.5rem)] max-w-6xl gap-0 overflow-y-auto rounded-[1.75rem] border-white/10 p-0 sm:rounded-[2rem] lg:max-w-6xl lg:overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("customizeName", { name: product.name })}</DialogTitle>
          <DialogDescription>{t("customizeDescription")}</DialogDescription>
        </DialogHeader>
        <CustomerModifierContent
          key={`${product.id}:${defaultBaristaId}`}
          product={product}
          baristas={baristas}
          defaultBaristaId={defaultBaristaId}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
