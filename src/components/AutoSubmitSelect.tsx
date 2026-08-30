"use client";

import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/ui/native-select";

type AutoSubmitSelectProps = Omit<
  ComponentProps<typeof NativeSelect>,
  "onChange"
>;

export default function AutoSubmitSelect(props: AutoSubmitSelectProps) {
  const resetKey = JSON.stringify(props.defaultValue ?? null);

  return (
    <NativeSelect
      key={resetKey}
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    />
  );
}
