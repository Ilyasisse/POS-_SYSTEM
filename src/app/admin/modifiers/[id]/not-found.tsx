import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Modifier not found</h1>
        <p className="mt-2 text-slate-600">
          The modifier you are looking for does not exist.
        </p>

        <Link
          href="/admin/modifiers"
          className="mt-4 inline-block rounded-lg border px-4 py-2 hover:bg-slate-50"
        >
          Back to Modifiers
        </Link>
      </div>
    </main>
  );
}