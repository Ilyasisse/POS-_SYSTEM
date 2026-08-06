"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type AutoSubmitInputProps = Omit<ComponentProps<typeof Input>, "onChange">;

export default function AutoSubmitInput(props: AutoSubmitInputProps) {
  return (
    <Input
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    />
  );
}
