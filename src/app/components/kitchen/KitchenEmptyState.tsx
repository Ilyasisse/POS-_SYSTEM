export default function KitchenEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 p-8 text-center">
      <p className="text-lg font-semibold text-slate-200">
        No active kitchen tickets.
      </p>
      <p className="mt-1 text-sm text-slate-400">
        New orders from waiter will appear here instantly.
      </p>
    </div>
  );
}