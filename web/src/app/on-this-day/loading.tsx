import { Skeleton } from "@/components/ui/skeleton"

export default function OnThisDayLoading() {
    return (
        <div>
            <section className="index-masthead relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                    <Skeleton className="mb-4 h-8 w-36 bg-white/10" />
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div className="max-w-4xl">
                            <Skeleton className="h-14 w-80 bg-white/10" />
                            <Skeleton className="mt-5 h-6 w-[38rem] max-w-full bg-white/10" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} className="h-24 w-28 bg-white/10" />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container py-12">
                <div className="grid gap-10 lg:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, cardIndex) => (
                        <div key={cardIndex} className="rounded-lg border bg-card/45 p-6">
                            <Skeleton className="h-8 w-40" />
                            <Skeleton className="mt-2 h-5 w-72 max-w-full" />
                            <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
                                {Array.from({ length: 6 }).map((__, index) => (
                                    <div key={index} className="flex flex-col gap-3">
                                        <Skeleton className="aspect-[2/3] rounded-lg" />
                                        <Skeleton className="h-5 w-3/4" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
