"use client"

import * as React from "react"
import { ArrowLeft, Search } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface HeroSectionProps {
    title: string
    subtitle?: string
    onSearch?: (query: string) => void
}

export function HeroSection({ title, subtitle, onSearch }: HeroSectionProps) {
    const [query, setQuery] = React.useState("")

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (query.trim() && onSearch) {
            onSearch(query.trim())
        }
    }

    return (
        <section className="archive-frame relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-white/10">
            <div className="absolute inset-0 hairline-grid opacity-50" />
            <div className="absolute inset-0 cinema-grain" />
            <div className="absolute bottom-8 left-6 hidden text-[8rem] font-bold leading-none text-white/[0.04] lg:block">
                1920
            </div>
            <div className="absolute right-6 top-8 hidden text-[8rem] font-bold leading-none text-white/[0.04] lg:block">
                2026
            </div>

            <div className="container relative flex min-h-[calc(100svh-4rem)] items-center py-10">
                <motion.div
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="max-w-4xl text-white"
                >
                    <div className="mb-7 flex items-center gap-4 text-sm font-semibold text-primary">
                        <span className="h-px w-16 bg-primary" />
                        <span>الأرشيف المصري للسينما</span>
                    </div>

                    <h1 className="text-6xl font-bold leading-none sm:text-8xl md:text-9xl">
                        {title}
                    </h1>
                    <p className="mt-5 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-5xl">
                        السينما المصرية، مفهرسة كما تعيش في الذاكرة.
                    </p>
                    {subtitle && (
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
                            {subtitle}
                        </p>
                    )}

                    {onSearch && (
                        <form onSubmit={handleSubmit} className="mt-10 max-w-3xl">
                            <div className="group flex flex-col gap-3 rounded-lg border border-white/18 bg-black/45 p-3 shadow-2xl shadow-black/30 backdrop-blur-md transition-colors focus-within:border-primary sm:flex-row sm:items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute start-0 top-1/2 -translate-y-1/2 text-primary" />
                                    <Input
                                        type="search"
                                        aria-label="البحث في أرشيف الأفلام"
                                        placeholder="اكتب اسما، سنة، ممثلا، أو وصفا لمشهد تتذكره"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        className="h-14 border-0 bg-transparent pe-4 ps-9 text-lg text-white placeholder:text-white/45 focus-visible:ring-0"
                                    />
                                </div>
                                <Button type="submit" size="lg" className="h-12 px-6">
                                    ابدأ البحث
                                    <ArrowLeft data-icon="inline-end" />
                                </Button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        </section>
    )
}
