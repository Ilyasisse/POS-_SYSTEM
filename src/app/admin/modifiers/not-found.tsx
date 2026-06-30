import { AdminNotFound } from "@/components/admin/shared/AdminNotFound";

export default function NotFound() {
  return (
    <AdminNotFound
      title="Modifier not found"
      href="/admin/modifiers"
      linkLabel="Back to modifiers"
    />
  );
}
