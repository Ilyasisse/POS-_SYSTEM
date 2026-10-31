import { requirePlatformAdmin } from "@/lib/cafeteria/platform-admin";
import CafeteriaManagement from "@/components/admin/CafeteriaManagement";

export default async function CafeteriasPage() {
  await requirePlatformAdmin();
  return <CafeteriaManagement />;
}
