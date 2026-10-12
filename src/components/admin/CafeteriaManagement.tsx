"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/toast";

type Cafe = { id: string; name: string; isActive: boolean; domains: { hostname: string }[] };
type Staff = { id: string; fullName: string; email: string; role: string; station: string | null; cafeteriaId: string; isActive: boolean; isPlatformAdmin: boolean };
const roles = ["ADMIN", "MANAGER", "CASHIER", "WAITER", "COOK", "BARISTA", "Cabitaan"];
const stations = ["CUNTO_SOOMAALI", "FAST_FOOD", "CABITAAN", "BARISTA"];
const field = "block w-full rounded-lg border p-2 text-sm bg-transparent";
const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-50";

export default function CafeteriaManagement() {
  const [data, setData] = useState<{ cafeterias: Cafe[]; staff: Staff[] }>({ cafeterias: [], staff: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function load() {
    const response = await fetch("/api/admin/cafeterias", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }
  useEffect(() => { let active = true;
    fetch("/api/admin/cafeterias", { cache: "no-store" }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); if (active) setData(body); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function save(input: object, form?: HTMLFormElement) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/cafeterias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      form?.reset(); await load();
      toast({ tone: "success", description: "Cafeteria configuration saved." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to save.";
      setError(message); toast({ tone: "error", description: message });
    } finally { setBusy(false); }
  }
  function submit(action: string) { return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    void save({ ...values, action, ...(action === "staff" ? { station: values.station || null } : {}) }, form);
  }; }
  const cafeSelect = <label>Cafeteria<select name="cafeteriaId" required className={field}>{data.cafeterias.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
  return <main className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Cafeterias and domains</h1><p className="text-sm text-gray-500">Manage separate cafeterias, their websites, and their staff accounts.</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-600">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit("create")} className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Add cafeteria</h2>
        <label>Name<input name="name" required minLength={2} maxLength={100} className={field} /></label>
        <label>Identifier<input name="id" required pattern="[a-z0-9][a-z0-9-]{1,49}" placeholder="example-cafe" className={field} /></label>
        <button disabled={busy} className={button}>Create cafeteria</button>
      </form>
      <form onSubmit={submit("domain")} className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Connect domain</h2>{cafeSelect}
        <label>Hostname<input name="hostname" required placeholder="cafe.example.com" className={field} /></label>
        <p className="text-sm text-gray-500">Also add this domain to your hosting project and configure its DNS records.</p>
        <button disabled={busy} className={button}>Add domain</button>
      </form>
    </div>
    <section className="space-y-3"><h2 className="font-semibold">Cafeterias</h2>{data.cafeterias.map((c) => <article key={c.id} className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{c.name}</h3><p className="text-sm">{c.isActive ? "Active" : "Archived"}</p></div>
        {c.id !== "mashallah" && <button disabled={busy} className={button} onClick={() => void save({ action: "status", id: c.id, isActive: !c.isActive })}>{c.isActive ? "Archive cafeteria" : "Reactivate"}</button>}</div>
      <p className="mt-2 text-sm text-gray-500">Archiving blocks access and preserves sales history.</p>
      {c.domains.map((d) => <div className="mt-2 flex items-center justify-between" key={d.hostname}><span>{d.hostname}</span>{c.id !== "mashallah" && <button disabled={busy} className={button} onClick={() => void save({ action: "removeDomain", hostname: d.hostname })}>Remove domain</button>}</div>)}
    </article>)}</section>
    <form onSubmit={submit("staff")} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Add staff account</h2><div className="grid gap-3 md:grid-cols-2">{cafeSelect}
      <label>Full name<input name="fullName" required minLength={2} className={field} /></label>
      <label>Email<input name="email" type="email" required className={field} /></label>
      <label>Temporary password<input name="password" type="password" autoComplete="new-password" required minLength={12} className={field} /></label>
      <label>Role<select name="role" className={field}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label>Kitchen station<select name="station" className={field}><option value="">No station</option>{stations.map((s) => <option key={s}>{s}</option>)}</select></label></div>
      <button disabled={busy} className={button}>Create staff account</button>
    </form>
    <section><h2 className="mb-3 font-semibold">Staff by cafeteria</h2><div className="space-y-3">{data.staff.map((s) => <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div><p className="font-medium">{s.fullName}</p><p className="text-sm">{data.cafeterias.find((c) => c.id === s.cafeteriaId)?.name} · {s.email} · {s.isActive ? "Active" : "Inactive"}</p></div>
      {!s.isPlatformAdmin && <div className="flex flex-wrap gap-2">
        <select aria-label={`Role for ${s.fullName}`} disabled={busy} value={s.role} className={field} onChange={(e) => void save({ action: "staffRole", id: s.id, role: e.target.value, station: s.station })}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
        <select aria-label={`Station for ${s.fullName}`} disabled={busy} value={s.station ?? ""} className={field} onChange={(e) => void save({ action: "staffRole", id: s.id, role: s.role, station: e.target.value || null })}><option value="">No station</option>{stations.map((v) => <option key={v}>{v}</option>)}</select>
        <button disabled={busy} className={button} onClick={() => void save({ action: "staffStatus", id: s.id, isActive: !s.isActive })}>{s.isActive ? "Deactivate" : "Reactivate"}</button>
      </div>}{s.isPlatformAdmin && <span className="text-sm">Platform administrator</span>}
    </article>)}</div></section>
  </main>;
}
