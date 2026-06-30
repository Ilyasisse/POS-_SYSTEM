"use client";

import { NativeSelect } from "@/components/ui/native-select";

type AutoSubmitSelectProps = {
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
};

export default function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: AutoSubmitSelectProps) {
  return (
    <NativeSelect
      name={name}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {children}
    </NativeSelect>
  );
}
