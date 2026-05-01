"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModifierGroup, Product, StaffSummary } from "@/lib/types";
import {
  getCustomerModifierGroups,
  getCustomerProductImage,
} from "./customer-fallbacks";
import {
  buildModifierLines,
  formatCurrency,
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

export default function CustomerModifierModal({
  open,
  product,
  baristas,
  onClose,
  onConfirm,
}: CustomerModifierModalProps) {
  const [selected, setSelected] = useState<SelectedModifiersMap>({});
  const [selectedBaristaId, setSelectedBaristaId] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected({});
    setSelectedBaristaId(
      product?.category?.station === "BARISTA" ? (baristas[0]?.id ?? "") : "",
    );
  }, [baristas, open, product]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const modifierGroups = useMemo(
    () => (product ? getCustomerModifierGroups(product) : []),
    [product],
  );
  const usingFallbackModifiers =
    product != null &&
    (!Array.isArray(product.modifierGroups) || product.modifierGroups.length === 0);

  const selectedLines = useMemo(
    () => (product ? buildModifierLines(product, selected) : []),
    [product, selected],
  );
  const previewTotal = useMemo(() => {
    if (!product) {
      return 0;
    }

    return (
      Number(product.price) +
      selectedLines.reduce((sum, modifier) => sum + modifier.price * modifier.qty, 0)
    );
  }, [product, selectedLines]);

  const errors = useMemo(() => {
    return modifierGroups.reduce<Record<string, string>>((accumulator, group) => {
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
  }, [modifierGroups, selected]);

  const hasBaristaRequirement =
    product?.category?.station === "BARISTA" && !selectedBaristaId;
  const disabled = !product || Object.keys(errors).length > 0 || hasBaristaRequirement;

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

  if (!open || !product) {
    return null;
  }

  return (
        <div
          data-aos="fade"
          data-aos-duration="200"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-md sm:p-6"
          onClick={onClose}
        >
          <div
            data-aos="zoom-in"
            data-aos-duration="240"
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#f6efe6] text-stone-900 shadow-[0_45px_140px_rgba(28,16,10,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid flex-1 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[16rem] overflow-hidden bg-[linear-gradient(145deg,#2b1f18_0%,#4f2e1f_45%,#925d2d_100%)] p-6 text-white sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.18),transparent_26%)]" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.32em] text-amber-200/90">
                        Customize Item
                      </p>
                      <h2
                        className="mt-3 max-w-md text-4xl leading-tight sm:text-5xl"
                        style={{
                          fontFamily:
                            '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
                        }}
                      >
                        {product.name}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="max-w-md">
                      <p className="text-sm leading-6 text-stone-100/80">
                        {product.description?.trim() ||
                          "Choose the details that make this item exactly how you want it."}
                      </p>
                      <p className="mt-4 text-sm uppercase tracking-[0.22em] text-amber-100/70">
                        Base price
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-amber-100">
                        {formatCurrency(Number(product.price))}
                      </p>
                    </div>

                    <div className="h-40 w-full max-w-xs overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10 shadow-2xl sm:h-48">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getCustomerProductImage(product)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex max-h-[92vh] flex-col overflow-hidden bg-[#f9f4ee]">
                <div className="border-b border-stone-200 px-6 py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                      {modifierGroups.length} groups
                    </span>
                    {usingFallbackModifiers ? (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-900">
                        Placeholder options
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900">
                        Live POS modifiers
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    Pick your size, extras, and finishing touches. Your total
                    updates instantly as you select options.
                  </p>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  {modifierGroups.map((group, groupIndex) => (
                    <section
                      key={group.id}
                      data-aos="fade-up"
                      data-aos-delay={String(groupIndex * 50)}
                      className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-[0_18px_45px_rgba(50,35,24,0.06)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-900">
                            {group.name}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">
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
                          const checked = (selected[group.id] || []).includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleOption(group, option.id)}
                              className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                                checked
                                  ? "border-[#7c5c37] bg-[#f5ebde] shadow-[0_16px_32px_rgba(124,92,55,0.15)]"
                                  : "border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-900">
                                    {option.name}
                                  </p>
                                  <p className="mt-1 text-sm text-stone-500">
                                    {Number(option.price) > 0
                                      ? `+${formatCurrency(Number(option.price))}`
                                      : "Included"}
                                  </p>
                                </div>
                                <span
                                  className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold uppercase ${
                                    checked
                                      ? "border-[#7c5c37] bg-[#7c5c37] text-white"
                                      : "border-stone-300 bg-white text-transparent"
                                  }`}
                                >
                                  ok
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {product.category?.station === "BARISTA" ? (
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
                        <select
                          value={selectedBaristaId}
                          onChange={(event) => setSelectedBaristaId(event.target.value)}
                          className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 outline-none"
                        >
                          <option value="">Select barista</option>
                          {baristas.map((barista) => (
                            <option key={barista.id} value={barista.id}>
                              {barista.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-stone-200 bg-white px-6 py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                        Selected add-ons
                      </p>
                      <p className="mt-2 text-sm text-stone-600">
                        {selectedLines.length === 0
                          ? "No extra selections yet."
                          : selectedLines
                              .map((modifier) => modifier.optionName)
                              .join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                        Item total
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-stone-950">
                        {formatCurrency(previewTotal)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      product && onConfirm(product, selected, selectedBaristaId || null)
                    }
                    disabled={disabled}
                    className="mt-5 w-full rounded-full bg-stone-950 px-6 py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
