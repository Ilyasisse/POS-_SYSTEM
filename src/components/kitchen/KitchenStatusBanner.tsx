type KitchenStatusBannerProps = {
  message: string;
};

export default function KitchenStatusBanner({
  message,
}: KitchenStatusBannerProps) {
  if (!message) return null;

  return (
    <p className="rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
      {message}
    </p>
  );
}
