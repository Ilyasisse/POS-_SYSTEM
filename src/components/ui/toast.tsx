"use client";

import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

export type ToastInput = {
  title?: string;
  description: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number | null;
};

type ToastItem = ToastInput & {
  id: string;
  closing: boolean;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const EXIT_DURATION = 220;
const SUCCESS_DURATION = 4_500;
const INFO_DURATION = 6_000;

const toneConfig = {
  success: {
    icon: CheckCircle2,
    fallbackTitle: "Success",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: CircleAlert,
    fallbackTitle: "Something went wrong",
    className:
      "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-50",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: TriangleAlert,
    fallbackTitle: "Action needed",
    className:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    fallbackTitle: "Update",
    className:
      "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-50",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
} satisfies Record<
  ToastTone,
  {
    icon: typeof Info;
    fallbackTitle: string;
    className: string;
    iconClassName: string;
  }
>;

function defaultDuration(tone: ToastTone) {
  if (tone === "success") return SUCCESS_DURATION;
  if (tone === "info") return INFO_DURATION;
  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);

    setToasts((current) =>
      current.map((item) =>
        item.id === id ? { ...item, closing: true } : item,
      ),
    );

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, EXIT_DURATION);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const tone = input.tone ?? "info";
      const duration =
        input.duration === undefined ? defaultDuration(tone) : input.duration;

      setToasts((current) => [
        ...current,
        { ...input, id, tone, closing: false },
      ]);

      if (duration != null && duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-[25rem]"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const tone = item.tone ?? "info";
  const config = toneConfig[tone];
  const Icon = config.icon;

  return (
    <section
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      aria-live={tone === "error" || tone === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "pointer-events-auto w-full overflow-hidden rounded-2xl border p-4 shadow-lg shadow-black/10",
        item.closing ? "toast-exit" : "toast-enter",
        config.className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn("mt-0.5 size-5 shrink-0", config.iconClassName)}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {item.title ?? config.fallbackTitle}
          </p>
          <p className="mt-1 text-sm leading-5 opacity-85">
            {item.description}
          </p>
          {item.action ? (
            item.action.href ? (
              <Link
                href={item.action.href}
                className="mt-3 inline-flex rounded-lg border border-current/20 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                {item.action.label}
              </Link>
            ) : (
              <button
                type="button"
                className="mt-3 rounded-lg border border-current/20 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  item.action?.onClick?.();
                  onDismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="-mr-1 -mt-1 rounded-lg p-1.5 opacity-65 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Dismiss notification"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}

export function ToastOnMount(props: ToastInput) {
  const { toast } = useToast();
  const lastShown = useRef("");
  const signature = JSON.stringify([
    props.tone,
    props.title,
    props.description,
    props.duration,
    props.action?.label,
    props.action?.href,
  ]);

  useEffect(() => {
    if (lastShown.current === signature) return;
    lastShown.current = signature;
    toast(props);
  }, [props, signature, toast]);

  return null;
}
