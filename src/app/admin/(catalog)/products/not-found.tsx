import { AdminNotFound } from "@/components/admin/shared/AdminNotFound";

export default function NotFound() {
  return (
    <AdminNotFound
      title="Product not found"
      href="/admin/products"
      linkLabel="Back to products"
    />
  );
}
