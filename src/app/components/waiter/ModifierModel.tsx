"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, StaffSummary } from "@/lib/types";

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
  baristas: StaffSummary[];
  onClose: () => void;
  onConfirm: (
    product: Product,
    selectedModifiers: SelectedModifiers,
    assignedBaristaId: string | null,
  ) => void;
};

function requiresBaristaAssignment(product: Product | null) {
  return product?.category?.station === "BARISTA";
}

export default function ModifierModal({
  open,
  product,
  baristas,
  onClose,
  onConfirm,
}: ModifierModalProps) {
  const [selected, setSelected] = useState<SelectedModifiers>({});
  const [selectedBaristaId, setSelectedBaristaId] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const modifierGroups = useMemo<ModifierGroup[]>(
    () =>
      product &&
      "modifierGroups" in product &&
      Array.isArray(product.modifierGroups)
        ? (product.modifierGroups as ModifierGroup[])
        : [],
    [product],
  );

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
            ? "Fadlan dooro ugu yaraan 1 ikhtiyaar."
            : `Fadlan dooro ugu yaraan ${min} ikhtiyaar.`;
        continue;
      }

      if (count > max) {
        errors[group.id] =
          max === 1
            ? "Waxaad dooran kartaa hal ikhtiyaar oo keliya."
            : `Waxaad dooran kartaa ugu badnaan ${max} ikhtiyaar.`;
      }
    }

    if (requiresBaristaAssignment(product) && !selectedBaristaId) {
      errors.barista = "Dooro baristaha qaadanaya sheygan.";
    }

    return errors;
  }, [modifierGroups, product, selected, selectedBaristaId]);

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

      if (exists) {
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

    if (min === 0 && max === 1) return "(Ikhtiyaari, dooro ugu badnaan hal)";
    if (min === 1 && max === 1) return "(Dooro hal)";
    if (min === 0 && max > 1) {
      return `(Ikhtiyaari, dooro ugu badnaan ${max})`;
    }
    if (min === max) return `(Dooro ${min})`;
    return `(Dooro ${min} ilaa ${max})`;
  }

  function handleConfirm() {
    if (!product) return;

    if (!isValid) {
      alert("Fadlan sax xulashooyinka ka hor intaadan sii wadin.");
      return;
    }

    onConfirm(
      product,
      selected,
      selectedBaristaId ? selectedBaristaId : null,
    );
  }

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="flex h-full items-center justify-center">
        <div className="flex h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <p className="text-sm text-slate-500">
                Habee sheygan ka hor inta aan dalabka lagu darin.
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Xir
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {requiresBaristaAssignment(product) ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-slate-900">
                      U qoondee barista
                    </h3>
                    <p className="text-sm text-slate-600">
                      Badeecaddan waxay aadeysaa qeybta BARISTA. Dooro qofka
                      qaadanaya.
                    </p>
                  </div>

                  {baristas.length === 0 ? (
                    <p className="text-sm text-red-600">
                      Barista shaqeynaya lama helin. Ku dar isticmaale BARISTA
                      firfircoon ka hor inta aan sheygan la dirin.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {baristas.map((barista) => {
                        const checked = selectedBaristaId === barista.id;

                        return (
                          <button
                            key={barista.id}
                            type="button"
                            onClick={() => setSelectedBaristaId(barista.id)}
                            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                              checked
                                ? "border-amber-500 bg-white"
                                : "border-amber-200 hover:bg-white"
                            }`}
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {barista.fullName}
                              </p>
                              {barista.email ? (
                                <p className="text-sm text-slate-500">
                                  {barista.email}
                                </p>
                              ) : null}
                            </div>

                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                checked
                                  ? "border-amber-500"
                                  : "border-slate-400"
                              }`}
                            >
                              {checked ? (
                                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {validationErrors.barista ? (
                    <p className="mt-2 text-sm text-red-500">
                      {validationErrors.barista}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {modifierGroups.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Wax-ka-beddel lama heli karo.
                </p>
              ) : (
                modifierGroups.map((group) => {
                  const groupSelected = selected[group.id] || [];
                  const groupError = validationErrors[group.id];

                  return (
                    <div key={group.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold">{group.name}</h3>
                        {getMinSelect(group) > 0 ? (
                          <span className="text-sm text-red-500">*</span>
                        ) : null}
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
                                {checked ? (
                                  <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {groupError ? (
                        <p className="mt-2 text-sm text-red-500">{groupError}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
