import React from "react";
import SignOutButton from "../SignOutButton";

export default function HeaderWaiter() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#4F7CFF] px-4 py-3 text-white">
      <div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-100">
            Waiter
          </p>
          <h1 className="text-xl font-bold md:text-2xl">MAASH ALLAH CAFE</h1>
        </div>

        <div className="text-left text-sm">
          <p className="mb-1 block text-xs text-blue-100">Waiter Name</p>
        </div>
      </div>
      <div className="flex justify-end p-4">
        <SignOutButton />
      </div>
    </header>
  );
}
