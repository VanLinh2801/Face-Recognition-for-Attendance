import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";

export const metadata: Metadata = {
  title: "Face Recognition Attendance",
  description: "Admin dashboard for camera-based face recognition attendance.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NotificationsProvider>
            <AppShell>{children}</AppShell>
          </NotificationsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
