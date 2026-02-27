import Link from "next/link";

const pages = [
  { href: "/waiter", label: "Waiter POS", description: "Create orders and complete sales" },
  { href: "/kitchen", label: "Kitchen Board", description: "Receive and complete prep tickets" },
  { href: "/admin", label: "Admin Daily Totals", description: "Track total sales by waiter" },
];

export default function Home() {
  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4 py-8"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cafeteria POS</p>
          <h1 className="text-2xl font-bold text-slate-900">Control Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open each role page in separate tabs/devices for live WebSocket sync.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md transition hover:-translate-y-0.5 hover:border-[#4F7CFF]"
            >
              <p className="text-base font-bold text-slate-800">{page.label}</p>
              <p className="mt-1 text-sm text-slate-600">{page.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
