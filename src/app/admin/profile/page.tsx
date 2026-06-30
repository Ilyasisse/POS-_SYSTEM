import { Input } from "@/components/ui/input";
import { Circle, User } from "lucide-react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { Button, Card, AdminPage, ToneBadge } from "@/components/admin/shared";
import { updateAdminProfile } from "./actions";

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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          Profile updated.
        </div>
      ) : null}
      {status === "invalid_name" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          Full name is required.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-28 place-items-center rounded-full bg-slate-600 text-3xl font-black text-white shadow-lg shadow-slate-300">
              {getInitials(currentUser.fullName)}
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-950">
              {currentUser.fullName}
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              {formatRole(currentUser.role)}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700">
              <Circle className="size-2 fill-success text-success" />
              Online
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Profile Information
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Update the profile fields stored in the POS database.
              </p>
            </div>
          </div>

          <form
            action={updateAdminProfile}
            className="grid gap-4 lg:grid-cols-2"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Full Name
              </span>
              <Input
                name="fullName"
                type="text"
                defaultValue={currentUser.fullName}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Email
              </span>
              {/* REVIEW: Email is owned by Supabase auth; keep it read-only until auth update flow is designed. */}
              <Input
                type="email"
                value={currentUser.email}
                readOnly
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Phone
              </span>
              <Input
                name="phoneNumber"
                type="tel"
                defaultValue={currentUser.phoneNumber ?? ""}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <div className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Role
              </span>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                <ToneBadge tone="blue">
                  {formatRole(currentUser.role)}
                </ToneBadge>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Current Password
              </span>
              {/* REVIEW: Password changes require Supabase auth verification and are intentionally not wired yet. */}
              <Input
                type="password"
                value="************"
                readOnly
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                New Password
              </span>
              <Input
                type="password"
                value=""
                readOnly
                placeholder="Change password later"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500 outline-none"
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
