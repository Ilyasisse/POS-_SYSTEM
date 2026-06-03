import type { ReactNode } from "react";

type CashierLayoutProps = {
  children: ReactNode;
};

export default function CashierLayout({ children }: CashierLayoutProps) {
  return children;
}
