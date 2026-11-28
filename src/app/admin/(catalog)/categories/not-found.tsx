import { AdminNotFound } from "@/components/admin/shared/AdminNotFound";

export default function NotFound() {
  return (
    <AdminNotFound
      title="Category not found"
      href="/admin/categories"
      linkLabel="Back to categories"
    />
  );
}
