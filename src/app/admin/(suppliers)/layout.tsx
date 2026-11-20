import type { ReactNode } from "react";
import SupplierNavigation from "./SupplierNavigation";
import styles from "./workspace.module.css";
export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.workspace}>
      <SupplierNavigation />
      {children}
    </div>
  );
}
