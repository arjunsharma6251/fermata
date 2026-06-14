import type { Metadata } from "next";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/inter/index.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hearfermata.com"),
  title: {
    default: "fermata.",
    template: "%s · fermata",
  },
  description:
    "Takes a song you're obsessed with and explains the craft behind why it hits you.",
  openGraph: {
    siteName: "fermata",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
