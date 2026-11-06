import { Input } from "@/components/ui/input";
import { Circle, User } from "lucide-react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { Button, Card, AdminPage, ToneBadge } from "@/components/admin/shared";
import { updateAdminProfile } from "./actions";
import { ToastOnMount } from "@/components/ui/toast";

type ProfilePageProps = {
  searchParams?: Promise<{
    profileStatus?: string;
  }>;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role: string) {
  return role === "ADMIN" ? "Administrator" : role;
}

export default async function AdminProfilePage({
  searchParams,
}: ProfilePageProps) {
  const currentUser = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const params = await searchParams;
  const status = params?.profileStatus;

  return (
    <AdminPage title="My Profile" description="Manage your profile information">
      {status === "updated" ? (
        <ToastOnMount tone="success" description="Profile updated." />
      ) : null}
      {status === "invalid_name" ? (
        <ToastOnMount tone="error" description="Full name is required." />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-28 place-items-center rounded-full bg-primary text-3xl font-black text-primary-foreground shadow-lg shadow-black">
              {getInitials(currentUser.fullName)}
            </div>
            <h2 className="mt-5 text-xl font-black text-foreground">
              {currentUser.fullName}
            </h2>
            <p className="text-sm font-semibold text-muted-foreground">
              {formatRole(currentUser.role)}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              <Circle className="size-2 fill-success text-success" />
              Online
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">
                Profile Information
              </h2>
              <p className="text-sm font-medium text-muted-foreground">
                Update the profile fields stored in the POS database.
              </p>
            </div>
          </div>

          <form
            action={updateAdminProfile}
            className="grid gap-4 lg:grid-cols-2"
          >
            <label htmlFor="profile-full-name" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Full Name
              </span>
              <Input
                id="profile-full-name"
                name="fullName"
                type="text"
                defaultValue={currentUser.fullName}
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
                required
              />
            </label>

            <label htmlFor="profile-email" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Email
              </span>
              {/* REVIEW: Email is owned by Supabase auth; keep it read-only until auth update flow is designed. */}
              <Input
                id="profile-email"
                type="email"
                value={currentUser.email}
                readOnly
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground outline-none"
              />
            </label>

            <label htmlFor="profile-phone" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Phone
              </span>
              <Input
                id="profile-phone"
                name="phoneNumber"
                type="tel"
                defaultValue={currentUser.phoneNumber ?? ""}
                className="h-11 w-full rounded-lg border border-border px-3 text-sm font-medium outline-none focus:border-blue-400 dark:focus:border-blue-800 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-800"
              />
            </label>

            <div className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Role
              </span>
              <div className="flex h-11 items-center rounded-lg border border-border bg-card px-3">
                <ToneBadge tone="blue">
                  {formatRole(currentUser.role)}
                </ToneBadge>
              </div>
            </div>

            <label htmlFor="profile-current-password" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                Current Password
              </span>
              {/* REVIEW: Password changes require Supabase auth verification and are intentionally not wired yet. */}
              <Input
                id="profile-current-password"
                type="password"
                value="************"
                readOnly
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground outline-none"
              />
            </label>

            <label htmlFor="profile-new-password" className="block">
              <span className="mb-1 block text-sm font-bold text-foreground">
                New Password
              </span>
              <Input
                id="profile-new-password"
                type="password"
                value=""
                readOnly
                placeholder="Change password later"
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground outline-none"
              />
            </label>

            <div className="lg:col-span-2">
              <Button type="submit">Update Profile</Button>
            </div>
          </form>
        </Card>
      </section>
    </AdminPage>
  );
}
