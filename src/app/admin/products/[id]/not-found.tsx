import Link from "next/link";

/**
 * Renders a not-found fallback for this route segment.
 *
 * @returns The rendered not-found page.
 *
 * @remarks Used by this route segment when a requested record cannot be found.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black text-slate-950">Item was Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested Product resource could not be found.</p>
        <Link className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" href="/admin/products">
          Back to Product
        </Link>
      </div>
    </main>
  );
}