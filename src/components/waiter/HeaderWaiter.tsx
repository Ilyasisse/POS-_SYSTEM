"use client";

import React from "react";
import SignOutButton from "../SignOutButton";

type HeaderWaiterProps = {
  fullName: string;
  balanceAmount: number;
};

function formatMoney(value: number) {
  return `${value < 0 ? "-$" : "$"}${Math.abs(value).toFixed(2)}`;
}

export default function HeaderWaiter({
  fullName,
  balanceAmount,
}: HeaderWaiterProps) {
  const balancePillClass =
    balanceAmount < 0
      ? "bg-red-500"
      : "bg-green-500";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#4F7CFF] px-4 py-3 text-white">
      <div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-100">
            Kabalyeeri
          </p>
          <h1 className="text-xl font-bold md:text-2xl">
           MashAllah Cafe
          </h1>
        </div>

        <div className="mt-2 text-left text-sm">
          <p className="text-xs text-blue-100">Waiter Name</p>
          <p className="text-sm font-semibold text-white">{fullName}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 p-4">
        <div
          className={`rounded-full px-4 py-2 text-right shadow-sm ring-1 ring-white/20 backdrop-blur-sm ${balancePillClass}`}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">
            Balance
          </p>
          <p className="text-sm font-bold text-white">
            {formatMoney(balanceAmount)}
          </p>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
