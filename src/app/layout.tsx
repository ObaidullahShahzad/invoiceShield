import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "InvoiceShield", template: "%s · InvoiceShield" },
  description: "Evidence-based invoice review for finance teams. Flags anomalies; people make the decisions.",
};

export const viewport: Viewport = { themeColor: "#f7f7f8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-[10px] !border-line !bg-surface !shadow-pop !text-[13px] !text-ink !font-sans",
              description: "!text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
