import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  description?: string;
  error?: string;
  className?: string;
};

export function FormField({
  id,
  label,
  children,
  description,
  error,
  className,
}: FormFieldProps) {
  const detailsId = description || error ? `${id}-details` : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description || error ? (
        <p
          id={detailsId}
          className={cn(
            "text-xs text-muted-foreground",
            error && "font-medium text-destructive",
          )}
          role={error ? "alert" : undefined}
        >
          {error ?? description}
        </p>
      ) : null}
    </div>
  );
}
