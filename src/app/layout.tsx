import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "HedHog Airdrop - Black Gold Edition",
  description: "Join the HedHog airdrop and earn HHOG tokens by watching ads and completing tasks.",
};

export const viewport = {
  themeColor: '#000000',
  backgroundColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive" 
        />
      </head>
      <body className={`${outfit.variable} antialiased selection:bg-yellow-500 selection:text-black`}>
         <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
