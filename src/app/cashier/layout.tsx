import type { ReactNode } from "react";
import CashierLiveSync from "./CashierLiveSync";

type CashierLayoutProps = {
  children: ReactNode;
};

export default function CashierLayout({ children }: CashierLayoutProps) {
  return (
    <>
      <CashierLiveSync />
      {children}
    </>
  );
}
