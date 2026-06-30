import DashboardCard from "./UI Cards/DashboardCard";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  Layers3,
  ListTree,
  MessageCircle,
  Package,
  Puzzle,
  ReceiptText,
  Settings,
  TableProperties,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";

import { formatTime } from "@/lib/admin/helper/formartTime";
import NotificationCard from "./UI Cards/NotificationCard";
import QuickAccessCard from "./UI Cards/QuickAccessCard";
import { Decimal } from "@prisma/client/runtime/client";

const quickAccessNEW = [
  {
    href: "/admin/categories",
    icon: Layers3,
    title: "Categories",
    description: "Organize menu",
    tone: "blue" as const,
  },
  {
    href: "/admin/products",
    icon: Boxes,
    title: "Products",
    description: "Manage items",
    tone: "green" as const,
  },
  {
    href: "/admin/inventory",
    icon: Package,
    title: "Inventory",
    description: "Stock tracking",
    tone: "orange" as const,
  },
  {
    href: "/admin/modifiers",
    icon: Puzzle,
    title: "Modifiers",
    description: "Add-ons & extras",
    tone: "purple" as const,
  },
  {
    href: "/admin/modifier-groups",
    icon: ListTree,
    title: "Modifier Groups",
    description: "Option groups",
    tone: "pink" as const,
  },
  {
    href: "/admin/staff",
    icon: Users,
    title: "Staff",
    description: "Manage users",
    tone: "blue" as const,
  },
  {
    href: "/admin/tables",
    icon: TableProperties,
    title: "Tables",
    description: "Dine-in tables",
    tone: "green" as const,
  },
  {
    href: "/admin/orders",
    icon: ReceiptText,
    title: "Orders",
    description: "Live orders",
    tone: "orange" as const,
  },
  {
    href: "/admin/reports",
    icon: ChartNoAxesCombined,
    title: "Reports",
    description: "Analytics",
    tone: "blue" as const,
  },
  {
    href: "/admin/settings",
    icon: Settings,
    title: "Settings",
    description: "System setup",
    tone: "slate" as const,
  },
];
type DashboardProps = {
  lowStockSupplies: number;
  todayOrders: {
    id: string;
    status: string;
    total: Decimal;
  }[];
};

export default function Dashboard({
  lowStockSupplies,
  todayOrders,
}: DashboardProps) {
  const openTodayOrders = todayOrders.filter(
    (order) => order.status === "OPEN",
  ).length;
  const notificationTime = formatTime(new Date());

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,2.2fr)_minmax(22rem,0.95fr)]">
      <DashboardCard
        title="Quick Access"
        icon={Zap}
        action={
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Manage All
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickAccessNEW.map((item) => (
            <QuickAccessCard key={item.href} {...item} />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title="Alerts & Notifications" icon={Bell}>
        <NotificationCard
          icon={TriangleAlert}
          title="Low Stock Alert"
          description={`${lowStockSupplies} items are running low`}
          time={notificationTime}
          tone="pink"
        />
        <NotificationCard
          icon={ReceiptText}
          title="Today's Orders"
          description={`${openTodayOrders} active orders`}
          time={notificationTime}
          tone="orange"
        />
        <NotificationCard
          icon={MessageCircle}
          title="WhatsApp Alerts"
          // REVIEW: Replace with live WhatsApp inbox data when that integration exposes status/messages.
          description="Connected and ready"
          time={notificationTime}
          tone="green"
        />
        <Link
          href="/admin/inventory"
          className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:text-blue-700"
        >
          View all notifications
          <ArrowRight className="size-4" />
        </Link>
      </DashboardCard>
    </section>
  );
}
