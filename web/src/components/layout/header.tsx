"use client"

import Link from "next/link"
import { Building2, Clapperboard, Film, Menu, Moon, Search, Sparkles, Sun, Tags, UserRound } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const links = [
    { href: "/search", label: "البحث", icon: Search },
    { href: "/on-this-day", label: "في مثل هذا اليوم", icon: Sparkles },
    { href: "/movies", label: "الأفلام", icon: Clapperboard },
    { href: "/people", label: "الفنانون", icon: UserRound },
    { href: "/companies", label: "الشركات", icon: Building2 },
    { href: "/genres", label: "التصنيفات", icon: Tags },
]

export function Header() {
    const { setTheme } = useTheme()

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
            <div className="container flex h-16 items-center gap-4">
                <Link href="/" className="group flex items-center gap-3 rounded-md">
                    <span className="flex size-9 items-center justify-center rounded-md border border-primary/35 bg-primary text-primary-foreground shadow-lg shadow-primary/15 transition-transform duration-300 group-hover:-translate-y-0.5">
                        <Film />
                    </span>
                    <span className="text-2xl font-bold tracking-normal">ElFilm</span>
                </Link>

                <nav data-pagefind-ignore className="hidden items-center gap-1 rounded-md border border-white/10 bg-card/35 p-1 text-sm font-medium md:flex">
                    {links.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="ms-auto flex items-center gap-2">
                    <Button asChild variant="ghost" className="hidden sm:inline-flex">
                        <Link href="/search">
                            <Search data-icon="inline-start" />
                            ابحث الآن
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="hidden border-primary/45 bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:bg-primary/90 lg:inline-flex"
                    >
                        <Link href="/movies">ابدأ التصفح</Link>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="تغيير المظهر">
                                <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">تغيير المظهر</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setTheme("light")}>
                                فاتح
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}>
                                داكن
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("system")}>
                                حسب النظام
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden" aria-label="فتح القائمة">
                                <Menu />
                                <span className="sr-only">فتح القائمة</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="border-border bg-background/95">
                            <SheetTitle className="sr-only">قائمة الموقع</SheetTitle>
                            <div className="flex items-center gap-2 px-4 pt-8">
                                <span className="flex size-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                                    <Film />
                                </span>
                                <span className="font-bold">ElFilm</span>
                            </div>
                            <div className="mt-8 flex flex-col gap-2 px-4">
                                {links.map(({ href, label, icon: Icon }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        className="flex min-h-12 items-center gap-3 rounded-md px-3 py-3 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <Icon />
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
