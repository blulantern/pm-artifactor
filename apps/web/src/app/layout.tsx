import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "PM Artifactor", description: "Local-first PPM copilot" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen)
          inject attributes onto <body> before React hydrates; this is scoped to <body> only. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
