import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RealDebrid — Manager",
  description:
    "Gestiona tu biblioteca Real-Debrid: descargas, torrents, unrestrict y hosts con una UI moderna y rápida.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
