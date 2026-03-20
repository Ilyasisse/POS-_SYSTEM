import Link from "next/link";
import { prisma } from "@/lib/prisma";

const orderTypes = ["DINE_IN", "TAKEOUT", "DELIVERY"];
const paymentMethods = ["MYCASH", "GOLIS", "Dahabshiil", "OTHER"];
const kitchenStations = ["CUNTO_SOOMAALI", "FAST_FOOD", "CABITAAN", "BARISTA"];

export default async function AdminSettingsPage() {
  const [activeCategories, activeProducts, activeTables, activeStaff] =
    await Promise.all([
      prisma.category.count({
        where: {
          isActive: true,
        },
      }),
      prisma.product.count({
        where: {
          isActive: true,
        },
      }),
      prisma.table.count({
        where: {
          isActive: true,
        },
      }),
      prisma.user.count({
        where: {
          isActive: true,
        },
      }),
    ]);

  const configLinks = [
    {
      href: "/admin/categories",
      title: "Menu Categories",
      description: "Control how products are grouped and assigned to stations.",
    },
    {
      href: "/admin/products",
      title: "Products",
      description: "Add menu items, prices, and stock tracking settings.",
    },
    {
      href: "/admin/modifiers-groups",
      title: "Modifier Groups",
      description: "Define selection rules for extras and add-ons.",
    },
    {
      href: "/admin/staff",
      title: "Staff Access",
      description: "Review user roles, account status, and station assignment.",
    },
    {
      href: "/admin/tables",
      title: "Table Setup",
      description: "Check dine-in tables and open table activity.",
    },
  ];

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Admin Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            View the current POS configuration and jump to the area that manages
            it.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Categories</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeCategories}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Products</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeProducts}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Tables</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeTables}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Staff</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeStaff}
            </h2>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">
              Configuration Areas
            </h2>
            <div className="mt-4 space-y-3">
              {configLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="font-semibold text-slate-900">{link.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">Current Defaults</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Kitchen Stations</p>
                <p className="mt-1">{kitchenStations.join(", ")}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Order Types</p>
                <p className="mt-1">{orderTypes.join(", ")}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Payment Methods</p>
                <p className="mt-1">{paymentMethods.join(", ")}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Admin Access</p>
                <p className="mt-1">
                  Admin routes require an authenticated admin account.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
