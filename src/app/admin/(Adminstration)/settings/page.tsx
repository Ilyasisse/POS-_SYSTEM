import Link from "next/link";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button, Card, AdminPage, MetricCard } from "@/components/admin/shared";
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

  return (
    <AdminPage
      title="Settings"
      description="Manage system settings and preferences"
      action={
        <Button asChild>
          <Link href="/admin/settings/hardware">Payment phone health</Link>
        </Button>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="overflow-hidden p-2">
          <nav className="space-y-1">
            {tabs.map((tab, index) => (
              <a
                key={tab}
                href={`#${tab.toLowerCase().replaceAll(" ", "-")}`}
                className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                  index === 0
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-muted-foreground hover:bg-card"
                }`}
              >
                {tab}
              </a>
            ))}
          </nav>
        </Card>

        <Card className="p-5">
          <h2 id="general" className="text-foreground text-lg font-black">
            General Settings
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Configure business defaults used across the POS.
          </p>

          {/* REVIEW: Settings form is UI-only until persistent cafe configuration fields are defined. */}
          <form className="mt-5 grid gap-4 lg:grid-cols-2">
            <label htmlFor="settings-business-name" className="block">
              <span className="text-foreground mb-1 block text-sm font-bold">Business Name</span>
              <Input
                id="settings-business-name"
                defaultValue="Mash Allah Cafe"
                className="border-border h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
              />
            </label>
            <label htmlFor="settings-currency" className="block">
              <span className="text-foreground mb-1 block text-sm font-bold">Currency</span>
              <NativeSelect
                id="settings-currency"
                className="border-border h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
              >
                <option>USD - US Dollar</option>
                <option>SOS - Somali Shilling</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-timezone" className="block">
              <span className="text-foreground mb-1 block text-sm font-bold">Timezone</span>
              <NativeSelect
                id="settings-timezone"
                className="border-border h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
              >
                <option>UTC+03:00 Nairobi</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-date-format" className="block">
              <span className="text-foreground mb-1 block text-sm font-bold">Date Format</span>
              <NativeSelect
                id="settings-date-format"
                className="border-border h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
              >
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-language" className="block">
              <span className="text-foreground mb-1 block text-sm font-bold">Language</span>
              <NativeSelect
                id="settings-language"
                className="border-border h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
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
