import DashboardCard from "./UI Cards/DashboardCard";
import SalesChartCard from "./UI Cards/SalesChartCard";
import StatePillCard from "./UI Cards/StatePillCard";
import {
  faChartLine,
  faDollarSign,
  faReceipt,
  faCube,
  faUsers,
  faRotateLeft,
  faArrowRight,
  faShieldHalved,
  faMugHot,
  faClipboardList,
  faCheck,
  faCommentDots,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import StatusRowCard from "./UI Cards/StatusRowCard";
import Link from "next/link";
import ActivityItemCard from "./UI Cards/ActivityItemCard";
import { formatTime } from "@/lib/admin/helper/formartTime";
import { formatMoney } from "@/lib/admin/helper/formatMoney";

type StatusProps = {
  recentOrders: {
    id: string;
    orderNumber: number;
    createdAt: Date;
  }[];
  recentProducts: {
    id: string;
    name: string;
    updatedAt: Date;
  }[];
  recentMovements: {
    id: string;
    itemName: string;
    quantityAfter: number;
    createdAt: Date;
  }[];
  chartPoints: {
    label: string;
    value: number;
  }[];
  totalSales: number;
  totalOrder: number;
  averageOrderValue: number;
  newCustomers: number;
};

export default function Status({
  recentOrders,
  recentProducts,
  recentMovements,
  chartPoints,
  totalSales,
  totalOrder: totalOrders,
  averageOrderValue,
  newCustomers,
}: StatusProps) {
  const activityItems = [
    // Converts recent orders into activity rows.
    ...recentOrders.map((order) => ({
      id: `order-${order.id}`,
      icon: faReceipt,
      text: `New order #${order.orderNumber} created`,
      time: formatTime(order.createdAt),
      tone: "blue" as const,
      date: order.createdAt,
      urgent: false,
    })),
    // Converts recently updated products into activity rows.
    ...recentProducts.map((product) => ({
      id: `product-${product.id}`,
      icon: faChartLine,
      text: `Product "${product.name}" updated`,
      time: formatTime(product.updatedAt),
      tone: "green" as const,
      date: product.updatedAt,
      urgent: false,
    })),
    // Converts recent inventory movements into activity rows.
    ...recentMovements.map((movement) => ({
      id: `movement-${movement.id}`,
      icon: faExclamationTriangle,
      text: `Inventory adjusted for ${movement.itemName}`,
      time: formatTime(movement.createdAt),
      tone: "orange" as const,
      date: movement.createdAt,
      urgent: movement.quantityAfter <= 5,
    })),
  ]// Sorts all activity rows by most recent first.
    .sort((first, second) => second.date.getTime() - first.date.getTime())
    // Limits the visible feed so the card stays compact.
    .slice(0, 5);


  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.8fr)_minmax(22rem,0.8fr)]">
      <DashboardCard
        title="Sales Overview"
        icon={faChartLine}
        action={
          <span className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            This Week
          </span>
        }
      >
        <SalesChartCard points={chartPoints} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatePillCard
            icon={faDollarSign}
            label="Total Sales"
            value={formatMoney(totalSales)}
            tone="blue"
          />
          <StatePillCard
            icon={faReceipt}
            label="Total Orders"
            value={totalOrders}
            tone="green"
          />
          <StatePillCard
            icon={faCube}
            label="Avg. Order Value"
            value={formatMoney(averageOrderValue)}
            tone="purple"
          />
          <StatePillCard
            icon={faUsers}
            label="New Customers"
            value={newCustomers}
            tone="orange"
          />
        </div>
      </DashboardCard>

      <DashboardCard title="Recent Activity" icon={faRotateLeft}>
        <div className="space-y-1">
          {activityItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500">
              No recent activity yet.
            </div>
          ) : (
            activityItems.map((item) => (
              <ActivityItemCard
                key={item.id}
                icon={item.icon}
                text={item.text}
                time={item.time}
                tone={item.tone}
                urgent={item.urgent}
              />
            ))
          )}
        </div>
        <Link
          href="/admin/orders"
          className="mt-4 inline-flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-black text-blue-600 hover:text-blue-700"
        >
          View all activity
          <FontAwesomeIcon icon={faArrowRight} />
        </Link>
      </DashboardCard>

      <DashboardCard title="System Status" icon={faShieldHalved}>
        <div className="space-y-3">
          <StatusRowCard icon={faMugHot} label="POS System" status="Online" />
          <StatusRowCard
            icon={faClipboardList}
            label="Database"
            status="Healthy"
          />
          <StatusRowCard
            icon={faCommentDots}
            label="WhatsApp Alerts"
            status="Connected"
          />
          {/* REVIEW: Backup status is display-only until backup metadata is stored. */}
          <StatusRowCard
            icon={faRotateLeft}
            label="Last Backup"
            status="Today"
          />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-700">
          <FontAwesomeIcon icon={faCheck} />
          System is running smoothly
        </div>
      </DashboardCard>
    </section>
  );
}
