"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";

type SelectedModifiers = Record<string, string[]>;

type ModifierOption = {
  id: string;
  name: string;
  price: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  required?: boolean;
  multiple?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: ModifierOption[];
};

type ModifierModalProps = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product, selectedModifiers: SelectedModifiers) => void;
};

export default function ModifierModal({
  open,
  product,
  onClose,
  onConfirm,
}: ModifierModalProps) {
  const [selected, setSelected] = useState<SelectedModifiers>({});

  useEffect(() => {
    if (open && product) {
      setSelected({});
    }
  }, [open, product]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const modifierGroups: ModifierGroup[] =
    product && "modifierGroups" in product && Array.isArray(product.modifierGroups)
      ? (product.modifierGroups as ModifierGroup[])
      : [];

  function getMinSelect(group: ModifierGroup) {
    if (typeof group.minSelect === "number") return group.minSelect;
    if (group.required) return 1;
    return 0;
  }

  function getMaxSelect(group: ModifierGroup) {
    if (typeof group.maxSelect === "number") return group.maxSelect;
    if (group.multiple) return group.options.length;
    return 1;
  }

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    for (const group of modifierGroups) {
      const count = (selected[group.id] || []).length;
      const min = getMinSelect(group);
      const max = getMaxSelect(group);

      if (count < min) {
        errors[group.id] =
          min === 1
            ? "Please choose at least 1 option."
            : `Please choose at least ${min} options.`;
        continue;
      }

      if (count > max) {
        errors[group.id] =
          max === 1
            ? "You can only choose 1 option."
            : `You can choose up to ${max} options.`;
      }
    }

    return errors;
  }, [modifierGroups, selected]);

  const isValid = Object.keys(validationErrors).length === 0;

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] || [];
      const exists = current.includes(optionId);
      const min = getMinSelect(group);
      const max = getMaxSelect(group);

      if (group.multiple) {
        if (exists) {
          if (current.length <= min) {
            return prev;
          }

          return {
            ...prev,
            [group.id]: current.filter((id) => id !== optionId),
          };
        }

        if (current.length >= max) {
          return prev;
        }

        return {
          ...prev,
          [group.id]: [...current, optionId],
        };
      }

      // Single select
      if (exists) {
        // allow deselect only if min is 0
        if (min === 0) {
          return {
            ...prev,
            [group.id]: [],
          };
        }

        return prev;
      }

      return {
        ...prev,
        [group.id]: [optionId],
      };
    });
  }

  function getSelectionHint(group: ModifierGroup) {
    const min = getMinSelect(group);
    const max = getMaxSelect(group);

    if (min === 0 && max === 1) return "(Optional, choose up to one)";
    if (min === 1 && max === 1) return "(Choose one)";
    if (min === 0 && max > 1) return `(Optional, choose up to ${max})`;
    if (min === max) return `(Choose ${min})`;
    return `(Choose ${min} to ${max})`;
  }

  function handleConfirm() {
    if (!product) return;

    if (!isValid) {
      alert("Please fix the modifier selections before continuing.");
      return;
    }

    onConfirm(product, selected);
  }

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="flex h-full items-center justify-center">
        <div className="flex h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <p className="text-sm text-slate-500">
                Select modifiers for this item
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Xir
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6">
            {modifierGroups.length === 0 ? (
              <p className="text-sm text-slate-500">No modifiers available.</p>
            ) : (
              <div className="space-y-6">
                {modifierGroups.map((group) => {
                  const groupSelected = selected[group.id] || [];
                  const groupError = validationErrors[group.id];

                  return (
                    <div key={group.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold">{group.name}</h3>
                        {getMinSelect(group) > 0 && (
                          <span className="text-sm text-red-500">*</span>
                        )}
                        <span className="text-xs text-slate-500">
                          {getSelectionHint(group)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.options.map((option) => {
                          const checked = groupSelected.includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleOption(group, option.id)}
                              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                                checked
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <div>
                                <p className="font-medium">{option.name}</p>
                                <p className="text-sm text-slate-500">
                                  +${Number(option.price).toFixed(2)}
                                </p>
                              </div>

                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  checked
                                    ? "border-blue-600"
                                    : "border-slate-400"
                                }`}
                              >
                                {checked && (
                                  <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {groupError && (
                        <p className="mt-2 text-sm text-red-500">{groupError}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50"
            >
              Xir
            </button>

            <button
              onClick={handleConfirm}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Ku dar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}