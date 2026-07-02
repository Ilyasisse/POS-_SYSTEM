import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "aos/dist/aos.css";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mash Allah cafe",
  description: "Mash Allah ",
  icons:{
    icon:"/newer_logo.png"
  }
};

const themeBootstrapScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("theme");
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    const resolvedTheme = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
