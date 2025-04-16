import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Background from "@/components/layout/background";
import toast, { Toaster } from "react-hot-toast";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Ask your MD",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-sans`}>
        <main>
          <Background>{children}</Background>
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
