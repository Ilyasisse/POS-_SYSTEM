import { AdminNotFound } from "@/components/admin/shared/AdminNotFound";

export default function NotFound() {
  return (
    <AdminNotFound
      title="Modifier group not found"
      href="/admin/modifier-groups"
      linkLabel="Back to modifier groups"
    />
  );
}
