"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type AutoSubmitInputProps = Omit<
  ComponentProps<typeof Input>,
  "onChange" | "onInput"
>;

export default function AutoSubmitInput(props: AutoSubmitInputProps) {
  return (
    <Input
      {...props}
      onInput={(event) => event.currentTarget.form?.requestSubmit()}
    />
  );
}
