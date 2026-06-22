type BackToTopButtonProps = {
  show: boolean;
  onClick: () => void;
};

export default function BackToTopButton({
  show,
  onClick,
}: BackToTopButtonProps) {
  if (!show) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-stone-950 text-white shadow-[0_18px_45px_rgba(44,28,17,0.28)] transition hover:-translate-y-0.5 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:bottom-7 sm:right-7 sm:h-14 sm:w-14"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
