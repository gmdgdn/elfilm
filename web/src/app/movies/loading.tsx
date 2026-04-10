import { Skeleton } from "@/components/ui/skeleton"

export default function MoviesLoading() {
    return (
        <div>
            <section className="index-masthead relative mb-12 overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                    <Skeleton className="mb-4 h-8 w-32 bg-white/10" />
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div className="max-w-3xl">
                            <Skeleton className="h-14 w-72 bg-white/10" />
                            <Skeleton className="mt-5 h-6 w-[32rem] max-w-full bg-white/10" />
                        </div>
                        <Skeleton className="h-16 w-40 bg-white/10" />
                    </div>
                </div>
            </section>

            <div className="container grid gap-10 lg:grid-cols-[280px_1fr]">
                <aside className="hidden lg:block">
                    <div className="sticky top-24 rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                    </div>
                </aside>

                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, index) => (
                            <div key={index} className="flex flex-col gap-3">
                                <Skeleton className="aspect-[2/3] rounded-lg" />
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
