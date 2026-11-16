import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: { default: "Mendwell: send the repair crew where the water is out", template: "%s | Mendwell" },
  description:
    "Mendwell ranks broken-pump risk from open water point data, plans each technician's day around the people who need water most, and lets villagers report a dead pump in two taps.",
};

export const viewport: Viewport = { themeColor: "#f3eee2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
