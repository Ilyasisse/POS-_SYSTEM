type HeaderProps = {
  categoryCount: number;
  productCount: number;
  modifierCount: number;
  staffCount: number;
  todayOrders: {
    id: string;
    status: string;
    total: Decimal;
  }[];
};

import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import StateCard from "./UI Cards/StateCard";

import {
  faBoxesStacked,
  faCubesStacked,
  faLayerGroup,
  faReceipt,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { Decimal } from "@prisma/client/runtime/client";

export default async function Header({
  categoryCount,
  productCount,
  modifierCount,
  staffCount,
  todayOrders,
}: HeaderProps) {
  const currentUser = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);

  const openTodayOrders = todayOrders.filter(
    (order) => order.status === "OPEN",
  ).length;
  const staffActiveDescription = `${staffCount} active staff`;
  return (
    <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Welcome back, {currentUser.fullName}!
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">
          Here&apos;s what&apos;s happening with your cafe today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StateCard
          icon={faLayerGroup}
          label="Total Categories"
          value={categoryCount}
          description="Active categories"
          tone="blue"
        />
        <StateCard
          icon={faBoxesStacked}
          label="Total Products"
          value={productCount}
          description="Active items"
          tone="green"
        />
        <StateCard
          icon={faCubesStacked}
          label="Total Modifiers"
          value={modifierCount}
          description="Add-ons & extras"
          tone="purple"
        />
        <StateCard
          icon={faUserGroup}
          label="Total Staff"
          value={staffCount}
          description={staffActiveDescription}
          tone="orange"
        />
        <StateCard
          icon={faReceipt}
          label="Today's Orders"
          value={todayOrders.length}
          description={`${openTodayOrders} live orders`}
          tone="pink"
        />
      </div>
    </section>
  );
}
