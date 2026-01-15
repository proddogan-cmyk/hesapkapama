import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "hesapkapama.com v2",
  description: "Film sektÇôrÇ¬ne Çôzel hesap kapama ve kasa takip uygulamasŽñ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="tr">
      <body>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            appearance={{
              variables: {
                colorBackground: "#020617",
                colorText: "#e2e8f0",
                colorPrimary: "#10b981",
                colorInputBackground: "#0b1220",
                colorInputText: "#e2e8f0",
              },
              elements: {
                card: "bg-slate-950 border border-white/10 shadow-2xl",
                headerTitle: "text-slate-100",
                headerSubtitle: "text-slate-300",
                socialButtonsBlockButton: "bg-white/5 border border-white/10 hover:bg-white/10 text-slate-100",
                formButtonPrimary: "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
                formFieldInput: "bg-white/5 border border-white/10 text-slate-100",
                footerActionLink: "text-emerald-300 hover:text-emerald-200",
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
