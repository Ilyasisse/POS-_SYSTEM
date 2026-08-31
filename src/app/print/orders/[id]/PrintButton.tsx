"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer /> Print receipt
    </Button>
  );
}
