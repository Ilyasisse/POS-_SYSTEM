import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button, Card, AdminPage } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { ToastOnMount } from "@/components/ui/toast";
import { formatTimeInput } from "@/lib/customer/online-ordering-hours";
import { saveOnlineOrderingHoursAction } from "./actions";
import { prisma } from "@/lib/prisma";

const tabs = [
  "General",
  "Business",
  "POS Settings",
  "Payment Methods",
  "Receipt",
  "Notifications",
  "Backup",
];

type AdminSettingsPageProps = {
  searchParams?: Promise<{ settingsStatus?: string }>;
};

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const [params, settings] = await Promise.all([
    searchParams,
    prisma.cafeSetting.findUnique({ where: { id: "default" } }),
  ]);

  const settingsNotice =
    params?.settingsStatus === "online_ordering_saved"
      ? {
          tone: "success" as const,
          message: "Online ordering hours were saved.",
        }
      : null;
  const invalidHours = params?.settingsStatus === "invalid_hours";

  return (
    <AdminPage
      title="Settings"
      description="Manage system settings and preferences"
    >
      {settingsNotice ? (
        <ToastOnMount
          tone={settingsNotice.tone}
          description={settingsNotice.message}
        />
      ) : null}
      <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="overflow-hidden p-2">
          <nav className="space-y-1">
            {tabs.map((tab, index) => (
              <a
                key={tab}
                href={`#${tab.toLowerCase().replaceAll(" ", "-")}`}
                className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                  index === 0
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "text-muted-foreground hover:bg-card"
                }`}
              >
                {tab}
              </a>
            ))}
          </nav>
        </Card>

        <Card className="p-5">
          <h2 id="general" className="text-lg font-black text-foreground">
            General Settings
          </h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Configure business defaults used across the POS.
          </p>

          {/* REVIEW: Settings form is UI-only until persistent cafe configuration fields are defined. */}
          <form className="mt-5 grid gap-4 lg:grid-cols-2">
            <label htmlFor="settings-business-name" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Business Name
              </span>
              <Input
                id="settings-business-name"
                defaultValue="Mash Allah Cafe"
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              />
            </label>
            <label htmlFor="settings-currency" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Currency
              </span>
              <NativeSelect
                id="settings-currency"
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              >
                <option>USD - US Dollar</option>
                <option>SOS - Somali Shilling</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-timezone" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Timezone
              </span>
              <NativeSelect
                id="settings-timezone"
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              >
                <option>UTC+03:00 Nairobi</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-date-format" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Date Format
              </span>
              <NativeSelect
                id="settings-date-format"
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              >
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
              </NativeSelect>
            </label>
            <label htmlFor="settings-language" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Language
              </span>
              <NativeSelect
                id="settings-language"
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              >
                <option>English</option>
                <option>Somali</option>
              </NativeSelect>
            </label>
            <div className="flex items-end lg:col-span-2">
              <Button type="button">Save Changes</Button>
            </div>
          </form>

          <div className="my-8 border-t border-border" />

          <div id="online-ordering" className="scroll-mt-6">
            <h2 className="text-lg font-black text-foreground">
              Online ordering
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Pause customer ordering or limit checkout to daily service hours.
              Use matching opening and closing times for 24-hour ordering.
            </p>
            <form
              action={saveOnlineOrderingHoursAction}
              className="mt-5 grid gap-4 lg:grid-cols-2"
            >
              <label className="flex items-center gap-3 rounded-xl border border-border p-4 lg:col-span-2">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={settings?.onlineOrderingEnabled ?? true}
                  className="size-5"
                />
                <span>
                  <strong className="block text-sm text-foreground">
                    Accept online orders
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    Turn this off to pause checkout immediately.
                  </span>
                </span>
              </label>
              <label htmlFor="online-order-start" className="block">
                <span className="mb-1 block text-sm font-bold text-foreground">
                  Opens
                </span>
                <Input
                  id="online-order-start"
                  name="startTime"
                  type="time"
                  required
                  aria-invalid={invalidHours}
                  aria-describedby={
                    invalidHours ? "online-ordering-hours-error" : undefined
                  }
                  defaultValue={formatTimeInput(
                    settings?.onlineOrderStartMinute ?? 0,
                  )}
                />
              </label>
              <label htmlFor="online-order-end" className="block">
                <span className="mb-1 block text-sm font-bold text-foreground">
                  Closes
                </span>
                <Input
                  id="online-order-end"
                  name="endTime"
                  type="time"
                  required
                  aria-invalid={invalidHours}
                  aria-describedby={
                    invalidHours ? "online-ordering-hours-error" : undefined
                  }
                  defaultValue={formatTimeInput(
                    settings?.onlineOrderEndMinute ?? 0,
                  )}
                />
              </label>
              {invalidHours ? (
                <p
                  id="online-ordering-hours-error"
                  role="alert"
                  className="text-sm text-destructive lg:col-span-2"
                >
                  Enter valid opening and closing times.
                </p>
              ) : null}
              <div className="lg:col-span-2">
                <Button type="submit">Save online ordering hours</Button>
              </div>
            </form>
          </div>
        </Card>
      </section>
    </AdminPage>
  );
}
