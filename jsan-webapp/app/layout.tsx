import type { Metadata } from "next";
import "./globals.css";
import "./styles/styles.css";
import "./styles/dashboard.css";
import "./styles/login.css";
import { AuthProvider } from "./AuthContext";

export const metadata: Metadata = {
  title: "JSAN 2025",
  description: "Journées Scientifiques de l'Alimentation et de la Nutrition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
