import type { Metadata, Viewport } from "next";
import { AppNav } from "@/components/app-nav";
import { ServiceWorker } from "@/components/service-worker";
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

export const metadata: Metadata = {
  title: "一日スケジュール",
  description: "カレンダーの予定を土台に、一日の使い方を組み立てる",
  // スマホのホーム画面から起動したときにブラウザの枠を出さない
  appleWebApp: {
    capable: true,
    title: "スケジュール",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  // タイムラインを指で動かすので、二本指ズームで倍率が変わると操作しづらい
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppNav />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
