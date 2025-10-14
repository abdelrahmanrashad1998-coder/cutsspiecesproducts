import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";

export const metadata: Metadata = {
  title: "Rable Shopify AI",
  description: "Enterprise-level platform to manage Shopify products with AI-powered features",
};

// Add viewport configuration for mobile responsiveness
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <SubscriptionProvider>
            <SettingsProvider>
              {children}
            </SettingsProvider>
          </SubscriptionProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
