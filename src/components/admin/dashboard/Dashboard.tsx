import DashboardCard from "./UI Cards/DashboardCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import {
  faBolt,
  faArrowRight,
  faExclamationTriangle,
  faBell,
  faReceipt,
  faCommentDots,
  faLayerGroup,
  faBoxesStacked,
  faCube,
  faPuzzlePiece,
  faUsers,
  faUserGroup,
  faTableCells,
  faChartLine,
  faGear,
} from "@fortawesome/free-solid-svg-icons";

import { formatTime } from "@/lib/admin/helper/formartTime";
import NotificationCard from "./UI Cards/NotificationCard";
import QuickAccessCard from "./UI Cards/QuickAccessCard";
import { Decimal } from "@prisma/client/runtime/client";

const quickAccessNEW = [
  {
    href: "/admin/categories",
    icon: faLayerGroup,
    title: "Categories",
    description: "Organize menu",
    tone: "blue" as const,
  },
  {
    href: "/admin/products",
    icon: faBoxesStacked,
    title: "Products",
    description: "Manage items",
    tone: "green" as const,
  },
  {
    href: "/admin/inventory",
    icon: faCube,
    title: "Inventory",
    description: "Stock tracking",
    tone: "orange" as const,
  },
  {
    href: "/admin/modifiers",
    icon: faPuzzlePiece,
    title: "Modifiers",
    description: "Add-ons & extras",
    tone: "purple" as const,
  },
  {
    href: "/admin/modifier-groups",
    icon: faUsers,
    title: "Modifier Groups",
    description: "Option groups",
    tone: "pink" as const,
  },
  {
    href: "/admin/staff",
    icon: faUserGroup,
    title: "Staff",
    description: "Manage users",
    tone: "blue" as const,
  },
  {
    href: "/admin/tables",
    icon: faTableCells,
    title: "Tables",
    description: "Dine-in tables",
    tone: "green" as const,
  },
  {
    href: "/admin/orders",
    icon: faReceipt,
    title: "Orders",
    description: "Live orders",
    tone: "orange" as const,
  },
  {
    href: "/admin/reports",
    icon: faChartLine,
    title: "Reports",
    description: "Analytics",
    tone: "blue" as const,
  },
  {
    href: "/admin/settings",
    icon: faGear,
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

export default function Dashboard({lowStockSupplies,todayOrders }: DashboardProps) {
  const openTodayOrders = todayOrders.filter(
    (order) => order.status === "OPEN",
  ).length;
  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,2.2fr)_minmax(22rem,0.95fr)]">
      <DashboardCard
        title="Quick Access"
        icon={faBolt}
        action={
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Manage All
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickAccessNEW.map((item) => (
            <QuickAccessCard key={item.href} {...item} />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title="Alerts & Notifications" icon={faBell}>
        <NotificationCard
          icon={faExclamationTriangle}
          title="Low Stock Alert"
          description={`${lowStockSupplies} items are running low`}
          time={formatTime(new Date())}
          tone="pink"
        />
        <NotificationCard
          icon={faReceipt}
          title="Today's Orders"
          description={`${openTodayOrders} active orders`}
          time={formatTime(new Date())}
          tone="orange"
        />
        <NotificationCard
          icon={faCommentDots}
          title="WhatsApp Alerts"
          // REVIEW: Replace with live WhatsApp inbox data when that integration exposes status/messages.
          description="Connected and ready"
          time={formatTime(new Date())}
          tone="green"
        />
        <Link
          href="/admin/inventory"
          className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:text-blue-700"
        >
          View all notifications
          <FontAwesomeIcon icon={faArrowRight} />
        </Link>
      </DashboardCard>
    </section>
  );
}
