import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "H2Q FastCons";


export const metadata: Metadata = {
  title: appName,
  description: "Nhật ký thi công hiện trường — H2Q FastCons PWA",
  applicationName: appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName,
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <style>{`
          button.bg-slate-900, a.bg-slate-900, button.bg-stone-900, a.bg-stone-900 {
            background: #1c1917 !important;
            color: #fff !important;
            backdrop-filter: none !important;
          }
          button.bg-amber-500, a.bg-amber-500, span.bg-amber-500, div.bg-amber-500 {
            background: #f59e0b !important;
            color: #1c1917 !important;
            backdrop-filter: none !important;
          }
          span.bg-amber-500, div.bg-amber-500 { color: #fff !important; }
        `}</style>
        {children}
      </body>
    </html>
  );
}
