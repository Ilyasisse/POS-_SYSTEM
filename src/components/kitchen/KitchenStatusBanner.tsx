type KitchenStatusBannerProps = {
  message: string;
};

export default function KitchenStatusBanner({
  message,
}: KitchenStatusBannerProps) {
  if (!message) return null;

  return (
    <p className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
      {message}
    </p>
  );
}