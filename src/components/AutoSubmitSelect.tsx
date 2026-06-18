"use client";

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
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {children}
    </select>
  );
}
