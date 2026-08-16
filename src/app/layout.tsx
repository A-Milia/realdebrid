import type { Metadata, Viewport } from "next";
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
  title: "RealDebrid",
  description:
    "App móvil para buscar, añadir y gestionar tu biblioteca Real-Debrid.",
  applicationName: "RealDebrid",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RealDebrid",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${outfit.variable} ${syne.variable} h-full antialiased`}
      style={{ colorScheme: "dark", backgroundColor: "#07090c" }}
    >
      <body
        className="min-h-full"
        style={{ backgroundColor: "#07090c", color: "#f2f4f7" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
