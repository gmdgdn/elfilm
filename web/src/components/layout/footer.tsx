import Link from "next/link"
import { Film } from "lucide-react"

const footerLinks = [
    { href: "/search", label: "البحث" },
    { href: "/on-this-day", label: "في مثل هذا اليوم" },
    { href: "/movies", label: "الأفلام" },
    { href: "/people", label: "الفنانون" },
    { href: "/companies", label: "الشركات" },
    { href: "/genres", label: "التصنيفات" },
]

export function Footer() {
    return (
        <footer className="mt-20 border-t bg-card/30">
            <div className="container grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
                <div className="max-w-xl">
                    <div className="mb-4 flex items-center gap-2">
                        <span className="flex size-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                            <Film />
                        </span>
                        <span className="text-xl font-bold">ElFilm</span>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">
                        الواجهة العامة الرسمية لـ ElFilm على <span className="font-medium text-foreground">film.gmd.gdn</span>:
                        أفلام، فنانين، شركات إنتاج، بحث ذكي، وذاكرة يومية في مكان واحد.
                    </p>
                </div>

                <nav data-pagefind-ignore className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {footerLinks.map((link) => (
                        <Link key={link.href} href={link.href} className="hover:text-foreground">
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
