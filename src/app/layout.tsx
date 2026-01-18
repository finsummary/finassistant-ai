import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinAssistant – Financial Assistant",
  description: "We are building a simple Financial Assistant. Join the waitlist.",
  metadataBase: new URL('https://finassistant.ai'),
  openGraph: {
    title: 'FinAssistant – Financial Assistant',
    description: 'We are building a simple Financial Assistant. Join the waitlist.',
    url: 'https://finassistant.ai',
    siteName: 'FinAssistant',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FinAssistant – Financial Assistant',
    description: 'We are building a simple Financial Assistant. Join the waitlist.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
