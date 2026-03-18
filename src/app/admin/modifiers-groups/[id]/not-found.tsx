import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">

      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">

        <h1 className="text-2xl font-bold">
          Modifier Group not found
        </h1>

        <p className="mt-2 text-slate-600">
          The group you are looking for does not exist.
        </p>

        <Link
          href="/admin/modifier-groups"
          className="mt-4 inline-block border px-4 py-2 rounded"
        >
          Back
        </Link>

      </div>

    </main>
  );
}