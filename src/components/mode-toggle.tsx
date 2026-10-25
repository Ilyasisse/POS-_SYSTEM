"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeLabels = { changeTheme: string; light: string; dark: string; system: string };

const defaultLabels: ThemeLabels = {
  changeTheme: "Change color theme",
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ModeToggle({ labels = defaultLabels }: { labels?: ThemeLabels }) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={labels.changeTheme}>
          <Sun className="size-4 scale-100 rotate-0 opacity-100 transition-[transform,opacity] motion-reduce:transition-none dark:scale-95 dark:-rotate-90 dark:opacity-0" />
          <Moon className="absolute size-4 scale-95 rotate-90 opacity-0 transition-[transform,opacity] motion-reduce:transition-none dark:scale-100 dark:rotate-0 dark:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun data-icon="inline-start" /> {labels.light}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon data-icon="inline-start" /> {labels.dark}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop data-icon="inline-start" /> {labels.system}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
