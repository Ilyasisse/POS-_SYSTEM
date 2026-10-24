import { Inter } from "next/font/google";

// Scope the design font to order cards; Next.js self-hosts the font at build time.
export const orderFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
