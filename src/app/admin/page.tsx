import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const [
    categoryCount,
    productCount,
    modifierCount,
    modifierGroupCount,
    userRows,
    tableCount,
    openOrdersCount,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.modifier.count(),
    prisma.modifierGroup.count(),
    prisma.user.findMany({
      select: {
        role: true,
      },
    }),
    prisma.table.count(),
    prisma.order.count({
      where: {
        status: "OPEN",
      },
    }),
  ]);
  const staffCount = userRows.filter((user) => user.role !== "CUSTOMER").length;

  const sections = [
    {
      href: "/admin/categories",
      title: "Categories",
      value: categoryCount,
      description: "Organize the menu by kitchen station and sort order.",
    },
    {
      href: "/admin/products",
      title: "Products",
      value: productCount,
      description: "Manage items, pricing, category links, and stock tracking.",
    },
    {
      href: "/admin/inventory",
      title: "Inventory",
      value: null,
      description: "Track stock levels, supply adjustments, and WhatsApp alerts.",
    },
    {
      href: "/admin/modifiers",
      title: "Modifiers",
      value: modifierCount,
      description: "Edit add-ons and extras attached to products.",
    },
    {
      href: "/admin/modifiers-groups",
      title: "Modifier Groups",
      value: modifierGroupCount,
      description: "Control selection limits and active option groups.",
    },
    {
      href: "/admin/staff",
      title: "Staff",
      value: staffCount,
      description: "Review user roles, stations, and account status.",
    },
    {
      href: "/admin/tables",
      title: "Tables",
      value: tableCount,
      description: "Monitor dine-in tables and active service coverage.",
    },
    {
      href: "/admin/orders",
      title: "Orders",
      value: openOrdersCount,
      description: "Track live orders, payments, and current service load.",
    },
    {
      href: "/admin/reports",
      title: "Reports",
      value: null,
      description: "View daily totals, station performance, and sales activity.",
    },
    {
      href: "/admin/settings",
      title: "Settings",
      value: null,
      description: "See the current POS configuration and admin setup areas.",
    },
  ];

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            MASH ALLAH Cafe POS
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage menu data, staff, service tables, reports, and system
            configuration from one place.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {section.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {section.description}
                  </p>
                </div>

                {section.value !== null ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                    {section.value}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
