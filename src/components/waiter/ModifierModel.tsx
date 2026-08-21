"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useEffect, useMemo, useState } from "react";
import type { Product, StaffSummary } from "@/lib/types";
import { playPronunciationSegments } from "@/lib/waiter/waiter-pronunciation";

type SelectedModifiers = Record<string, string[]>;

type ModifierOption = {
  id: string;
  name: string;
  price: number;
  pronunciationAudioUrl?: string | null;
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

type ValidationErrors = Record<string, string>;

type SelectedSummaryItem = {
  groupName: string;
  optionName: string;
  price: number;
};

type ModifierModalHeaderProps = {
  product: Product;
  onClose: () => void;
};

type SelectedModifierSummaryProps = {
  selectedSummary: SelectedSummaryItem[];
  selectedBaristaId: string;
  baristas: StaffSummary[];
};

type BaristaAssignmentSectionProps = {
  baristas: StaffSummary[];
  selectedBaristaId: string;
  error?: string;
  onSelectBarista: (baristaId: string) => void;
};

type ModifierGroupsSectionProps = {
  modifierGroups: ModifierGroup[];
  selected: SelectedModifiers;
  validationErrors: ValidationErrors;
  onToggleOption: (group: ModifierGroup, optionId: string) => void;
  onPlayModifier: (option: ModifierOption) => void;
};

type ModifierGroupCardProps = {
  group: ModifierGroup;
  groupSelected: string[];
  groupError?: string;
  onToggleOption: (group: ModifierGroup, optionId: string) => void;
  onPlayModifier: (option: ModifierOption) => void;
};

type ModifierModalFooterProps = {
  onClose: () => void;
  onConfirm: () => void;
};

function requiresBaristaAssignment(product: Product | null) {
  return product?.category?.station === "BARISTA";
}

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

function getSelectionHint(group: ModifierGroup) {
  const min = getMinSelect(group);
  const max = getMaxSelect(group);

  if (min === 0 && max === 1) return "(dooro ugu badnaan hal)";
  if (min === 1 && max === 1) return "(Dooro hal)";
  if (min === 0 && max > 1) {
    return `(dooro ugu badnaan hal ${max})`;
  }
  if (min === max) return `(Dooro ${min})`;
  return `(Dooro ${min} ilaa ${max})`;
}

function ModifierModalHeader({ product, onClose }: ModifierModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-linear-to-r from-slate-50 via-white to-blue-50 p-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-black leading-tight text-foreground">
            {product.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Habeey order-ka</p>
        </div>
      </div>

      <Button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-muted"
      >
        Xir
      </Button>
    </div>
  );
}

function SelectedModifierSummary({
  selectedSummary,
  selectedBaristaId,
  baristas,
}: SelectedModifierSummaryProps) {
  return (
    <section className="rounded-2xl border border-border bg-muted/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Waxaad Dooratay
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Hubi doorashooyinka ka hor inta aadan ku darin dalabka.
          </p>
        </div>
        <div className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
          {selectedSummary.length} la doortay
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {selectedBaristaId ? (
          <div className="rounded-xl border border-amber-200 bg-card px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Barista
            </p>
            <p className="text-sm font-semibold text-foreground">
              {baristas.find((barista) => barista.id === selectedBaristaId)
                ?.fullName ?? "Barista lama helin"}
            </p>
          </div>
        ) : null}

        {selectedSummary.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Weli wax modifier ah lama dooran.
          </p>
        ) : (
          selectedSummary.map((item) => (
            <div
              key={`${item.groupName}-${item.optionName}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.optionName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.groupName}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-emerald-700">
                +${item.price.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function BaristaAssignmentSection({
  baristas,
  selectedBaristaId,
  error,
  onSelectBarista,
}: BaristaAssignmentSectionProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">
          Dooro barista-ka
        </h3>
      </div>

      {baristas.length === 0 ? (
        <p className="text-sm text-red-600">
          No active barista was found. Add an active BARISTA user before sending
          this item.
        </p>
      ) : (
        <div className="space-y-2">
          {baristas.map((barista) => {
            const checked = selectedBaristaId === barista.id;

            return (
              <Button
                key={barista.id}
                type="button"
                onClick={() => onSelectBarista(barista.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  checked
                    ? "border-amber-500 bg-card shadow-sm"
                    : "border-amber-200 hover:bg-card"
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {barista.fullName}
                  </p>
                </div>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    checked ? "border-amber-500" : "border-slate-400"
                  }`}
                >
                  {checked ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  ) : null}
                </div>
              </Button>
            );
          })}
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </section>
  );
}

function ModifierGroupsSection({
  modifierGroups,
  selected,
  validationErrors,
  onToggleOption,
  onPlayModifier,
}: ModifierGroupsSectionProps) {
  if (modifierGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ma jiraan modifiers.</p>
    );
  }

  return (
    <>
      {modifierGroups.map((group) => (
        <ModifierGroupCard
          key={group.id}
          group={group}
          groupSelected={selected[group.id] || []}
          groupError={validationErrors[group.id]}
          onToggleOption={onToggleOption}
          onPlayModifier={onPlayModifier}
        />
      ))}
    </>
  );
}

function ModifierGroupCard({
  group,
  groupSelected,
  groupError,
  onToggleOption,
  onPlayModifier,
}: ModifierGroupCardProps) {
  const selectedOptionIdSet = new Set(groupSelected);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold text-foreground">{group.name}</h3>
        {getMinSelect(group) > 0 ? (
          <span className="text-sm text-red-500">*</span>
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">
          {getSelectionHint(group)}
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {groupSelected.length} selected
        </span>
      </div>

      <div className="space-y-2">
        {group.options.map((option) => {
          const checked = selectedOptionIdSet.has(option.id);

          return (
            <div
              key={option.id}
              className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                checked
                  ? "border-blue-600 bg-blue-50 shadow-sm"
                  : "border-border hover:bg-muted"
              }`}
            >
              <Button
                type="button"
                onClick={() => onToggleOption(group, option.id)}
                className="flex flex-1 items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {option.name}
                  </p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    ${Number(option.price).toFixed(2)}
                  </p>
                </div>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    checked ? "border-blue-600" : "border-slate-400"
                  }`}
                >
                  {checked ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  ) : null}
                </div>
              </Button>

              <Button
                type="button"
                onClick={() => onPlayModifier(option)}
                aria-label={`Play pronunciation for ${option.name}`}
                title={`Play pronunciation for ${option.name}`}
                className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M14.86 4.53a1.25 1.25 0 0 1 2.14.88v13.18a1.25 1.25 0 0 1-2.14.88l-3.77-3.72H7.75A2.75 2.75 0 0 1 5 13V11a2.75 2.75 0 0 1 2.75-2.75h3.34l3.77-3.72ZM18.53 8.97a.75.75 0 0 1 1.06.03 4.93 4.93 0 0 1 0 7 .75.75 0 1 1-1.09-1.03 3.43 3.43 0 0 0 0-4.94.75.75 0 0 1 .03-1.06Zm-1.96 1.71a.75.75 0 0 1 1.06.03 2.52 2.52 0 0 1 0 3.58.75.75 0 1 1-1.09-1.03 1.02 1.02 0 0 0 0-1.52.75.75 0 0 1 .03-1.06Z" />
                </svg>
              </Button>
            </div>
          );
        })}
      </div>

      {groupError ? (
        <p className="mt-2 text-sm text-red-500">{groupError}</p>
      ) : null}
    </div>
  );
}

function ModifierModalFooter({ onClose, onConfirm }: ModifierModalFooterProps) {
  return (
    <div className="flex justify-end gap-3 border-t border-border p-6">
      <Button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border px-4 py-2 hover:bg-muted"
      >
        Xir
      </Button>

      <Button
        type="button"
        onClick={onConfirm}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Ku dar dalab
      </Button>
    </div>
  );
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
  const [pronunciationStatus, setPronunciationStatus] = useState("");

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

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    for (const group of modifierGroups) {
      const count = (selected[group.id] || []).length;
      const min = getMinSelect(group);
      const max = getMaxSelect(group);

      if (count < min) {
        errors[group.id] =
          min === 1 ? "Fadlan dooro 1" : `Fadlan dooro ${min} `;
        continue;
      }

      if (count > max) {
        errors[group.id] =
          max === 1 ? "Waxaad dooran kartaa 1" : `Waxaad dooran kartaa ${max} `;
      }
    }

    if (requiresBaristaAssignment(product) && !selectedBaristaId) {
      errors.barista = "Dooro barista-ka";
    }

    return errors;
  }, [modifierGroups, product, selected, selectedBaristaId]);

  const isValid = Object.keys(validationErrors).length === 0;
  const selectedSummary = useMemo(() => {
    return modifierGroups.flatMap((group) => {
      const selectedOptionIds = selected[group.id] || [];
      const selectedOptionIdSet = new Set(selectedOptionIds);

      return group.options.flatMap((option) =>
        selectedOptionIdSet.has(option.id)
          ? [
              {
                groupName: group.name,
                optionName: option.name,
                price: Number(option.price),
              },
            ]
          : [],
      );
    });
  }, [modifierGroups, selected]);

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

  function handleConfirm() {
    if (!product) return;

    if (!isValid) {
      alert("Fadlan sax doorashooyinka");
      return;
    }

    onConfirm(product, selected, selectedBaristaId ? selectedBaristaId : null);
  }

  function handlePlayModifier(option: ModifierOption) {
    void playPronunciationSegments([
      {
        url: option.pronunciationAudioUrl ?? "",
        label: option.name,
      },
    ]).then((message) => {
      setPronunciationStatus(message ?? "");
    });
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[90vh] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Customize {product.name}</DialogTitle>
          <DialogDescription>
            Choose modifiers and an assigned barista before adding this item.
          </DialogDescription>
        </DialogHeader>
        <ModifierModalHeader product={product} onClose={onClose} />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {pronunciationStatus ? (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                {pronunciationStatus}
              </p>
            ) : null}

            <SelectedModifierSummary
              selectedSummary={selectedSummary}
              selectedBaristaId={selectedBaristaId}
              baristas={baristas}
            />

            {requiresBaristaAssignment(product) ? (
              <BaristaAssignmentSection
                baristas={baristas}
                selectedBaristaId={selectedBaristaId}
                error={validationErrors.barista}
                onSelectBarista={setSelectedBaristaId}
              />
            ) : null}

            <ModifierGroupsSection
              modifierGroups={modifierGroups}
              selected={selected}
              validationErrors={validationErrors}
              onToggleOption={toggleOption}
              onPlayModifier={handlePlayModifier}
            />
          </div>
        </div>

        <ModifierModalFooter onClose={onClose} onConfirm={handleConfirm} />
      </DialogContent>
    </Dialog>
  );
}
