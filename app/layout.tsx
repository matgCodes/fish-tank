import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Fish Tank",
  description: "An agent that lives in the glass-walled meeting room.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
