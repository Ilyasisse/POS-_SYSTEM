"use client";

import React from "react";
import SignOutButton from "../SignOutButton";

type HeaderWaiterProps = {
  fullName: string;
  totalSales: number;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function HeaderWaiter({
  fullName,
  totalSales,
}: HeaderWaiterProps) {
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
        <div className="rounded-full bg-green-500 px-4 py-2 text-right shadow-sm ring-1 ring-white/20 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">
            Iibka
          </p>
          <p className="text-sm font-bold text-white">
            {formatMoney(totalSales)}
          </p>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
