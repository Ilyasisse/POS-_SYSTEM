import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button, Card, AdminPage, MetricCard } from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

const tabs = [
  "General",
  "Business",
  "POS Settings",
  "Payment Methods",
  "Receipt",
  "Notifications",
  "Backup",
];

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
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
          role: {
            not: "CUSTOMER",
          },
        },
      }),
    ]);

  return (
    <AdminPage
      title="Settings"
      description="Manage system settings and preferences"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Categories" value={activeCategories} />
        <MetricCard label="Active Products" value={activeProducts} />
        <MetricCard label="Active Tables" value={activeTables} />
        <MetricCard label="Active Staff" value={activeStaff} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="overflow-hidden p-2">
          <nav className="space-y-1">
            {tabs.map((tab, index) => (
              <a
                key={tab}
                href={`#${tab.toLowerCase().replaceAll(" ", "-")}`}
                className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                  index === 0
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab}
              </a>
            ))}
          </nav>
        </Card>

        <Card className="p-5">
          <h2 id="general" className="text-lg font-black text-slate-950">
            General Settings
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Configure business defaults used across the POS.
          </p>

          {/* REVIEW: Settings form is UI-only until persistent cafe configuration fields are defined. */}
          <form className="mt-5 grid gap-4 lg:grid-cols-2">
            <label htmlFor="settings-business-name" className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Business Name
              </span>
              <Input
                id="settings-business-name"
                defaultValue="Mash Allah Cafe"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </label>
            <label htmlFor="settings-currency" className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Currency
              </span>
              <NativeSelect
                id="settings-currency"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                <option>USD - US Dollar</option>
                <option>SOS - Somali Shilling</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-timezone" className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Timezone
              </span>
              <NativeSelect
                id="settings-timezone"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                <option>UTC+03:00 Nairobi</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-date-format" className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Date Format
              </span>
              <NativeSelect
                id="settings-date-format"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-language" className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Language
              </span>
              <NativeSelect
                id="settings-language"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                <option>English</option>
                <option>Somali</option>
              </NativeSelect>
            </label>
            <div className="flex items-end lg:col-span-2">
              <Button type="button">Save Changes</Button>
            </div>
          </form>
        </Card>
      </section>
    </AdminPage>
  );
}
