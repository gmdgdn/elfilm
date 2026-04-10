import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { generateOrganizationSchema, generateWebSiteSchema, serializeJsonLd } from "@/lib/seo";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://film.gmd.gdn"),
  title: {
    template: "%s | ElFilm Archive",
    default: "ElFilm Archive - The Egyptian Cinema Database",
  },
  description: "الواجهة العامة الرسمية لأرشيف ElFilm: أفلام، فنانين، شركات، بحث ذكي، وذاكرة السينما المصرية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rootSchemas = [generateOrganizationSchema(), generateWebSiteSchema()];

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${ibmPlexSansArabic.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {rootSchemas.map((schema) => (
            <script
              key={(schema as { "@type": string })["@type"]}
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: serializeJsonLd(schema),
              }}
            />
          ))}
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1" data-pagefind-body>
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
