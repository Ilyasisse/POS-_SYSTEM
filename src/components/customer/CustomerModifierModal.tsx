"use client";

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
import type {
  ModifierGroup,
  Product,
  SelectedModifierLine,
  StaffSummary,
} from "@/lib/types";
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

type ModifierErrors = Record<string, string>;

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
        min === 1 ? "Choose 1 option." : `Choose at least ${min}.`;
    } else if (count > max) {
      accumulator[group.id] =
        max === 1 ? "Only 1 option allowed." : `Choose up to ${max}.`;
    }

    return accumulator;
  }, {});
}

function CustomerModifierHero({ product, onClose }: CustomerModifierHeroProps) {
  return (
    <div className="relative min-h-[18rem] overflow-hidden bg-stone-950 text-white lg:min-h-[32rem]">
      <Image
        src={getProductImage(product)}
        alt={product.name}
        fill
        sizes="(min-width: 1024px) 52vw, 100vw"
        unoptimized
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,12,8,0.25)_0%,rgba(20,12,8,0.42)_28%,rgba(20,12,8,0.78)_70%,rgba(20,12,8,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.18),transparent_28%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-7">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-200/90">
              Customize Item
            </p>
            <h2
              className="mt-3 max-w-md text-3xl leading-tight sm:text-4xl lg:text-5xl"
              style={{
                fontFamily:
                  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
              }}
            >
              {product.name}
            </h2>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-card/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-card/15 sm:px-4"
          >
            Close
          </Button>
        </div>

        <div className="  pl-5 pt-30 pr-0.5 text-right">
          <div className=" sm:w-2 rounded-[25px] sm:border border-white/10 sm:bg-black/20 bg-transparent p-4 sm:backdrop-blur-sm">
            <p className="text-sm leading-6 text-stone-100/80 hidden sm:block">
              {product.description?.trim() ||
                "Choose the details that make this item exactly how you want it."}
            </p>
            <p className="mt-4 text-sm uppercase tracking-[0.22em] text-amber-100/70 ">
              Base price
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
  return (
    <>
      {modifierGroups.map((group, groupIndex) => {
        const selectedOptionIdSet = new Set(selected[group.id] || []);

        return (
          <section
          key={group.id}
          data-aos="fade-up"
          data-aos-delay={String(groupIndex * 50)}
          className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_18px_45px_rgba(50,35,24,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {group.name}
              </h3>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Choose {getMinSelect(group)} to {getMaxSelect(group)}
              </p>
            </div>
            {errors[group.id] ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                {errors[group.id]}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.options.map((option) => {
              const checked = selectedOptionIdSet.has(option.id);

              return (
                <Button
                  key={option.id}
                  type="button"
                  onClick={() => onToggleOption(group, option.id)}
                  className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                    checked
                      ? "border-[#7c5c37] bg-[#f5ebde] shadow-[0_16px_32px_rgba(124,92,55,0.15)]"
                      : "border-border bg-muted/50 hover:border-border hover:bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {option.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {Number(option.price) > 0
                          ? `+${formatCurrency(Number(option.price))}`
                          : "Included"}
                      </p>
                    </div>
                    <span
                      className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold uppercase ${
                        checked
                          ? "border-[#7c5c37] bg-[#7c5c37] text-white"
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
  return (
    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-950">
            Barista assignment
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Choose who will prepare this drink.
          </p>
        </div>
        <NativeSelect
          value={selectedBaristaId}
          onChange={(event) => onSelectedBaristaIdChange(event.target.value)}
          className="rounded-full border border-amber-300 bg-card px-4 py-2 text-sm font-medium text-foreground outline-none"
        >
          <option value="">Select barista</option>
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
  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-card px-4 py-4 shadow-[0_-18px_45px_rgba(50,35,24,0.08)] sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Selected add-ons
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedLines.length === 0
              ? "No extra selections yet."
              : selectedLines.map((modifier) => modifier.optionName).join(", ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Item total
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatCurrency(previewTotal)}
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={onAddToCart}
        disabled={disabled}
        className="mt-5 w-full rounded-full bg-stone-950 px-6 py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        Add to cart
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
  const [selected, setSelected] = useState<SelectedModifiersMap>({});
  const [selectedBaristaId, setSelectedBaristaId] = useState(defaultBaristaId);

  const modifierGroups = useMemo(
    () => getProductModifierGroups(product),
    [product],
  );

  const selectedLines = useMemo(
    () => buildModifierLines(product, selected),
    [product, selected],
  );
  const previewTotal = useMemo(() => {
    return (
      Number(product.price) +
      selectedLines.reduce(
        (sum, modifier) => sum + modifier.price * modifier.qty,
        0,
      )
    );
  }, [product, selectedLines]);

  const errors = useMemo(
    () => getModifierSelectionErrors(modifierGroups, selected),
    [modifierGroups, selected],
  );

  const hasBaristaRequirement =
    product.category?.station === "BARISTA" && !selectedBaristaId;
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
    <div className="grid flex-1 items-start lg:grid-cols-[1.05fr_0.95fr]">
      <CustomerModifierHero product={product} onClose={onClose} />

      <div className="flex flex-col bg-[#f9f4ee]">
        <div className="border-b border-border px-4 py-4 sm:px-6 hidden sm:block">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {modifierGroups.length} groups
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Pick your size, extras, and finishing touches. Your total updates
            instantly as you select options.
          </p>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
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
          onAddToCart={() =>
            onConfirm(product, selected, selectedBaristaId || null)
          }
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
  if (!product) {
    return null;
  }

  const defaultBaristaId = getDefaultBaristaId(product, baristas);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[calc(100%-1.5rem)] max-w-6xl gap-0 overflow-y-auto rounded-[1.75rem] border-white/10 bg-[#f6efe6] p-0 text-foreground dark:bg-card dark:text-foreground sm:rounded-[2rem]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Customize {product.name}</DialogTitle>
          <DialogDescription>
            Choose modifiers and an optional barista before adding the item.
          </DialogDescription>
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
