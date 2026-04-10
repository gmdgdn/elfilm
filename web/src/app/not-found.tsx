import Link from "next/link"
import { Film } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="container flex min-h-[70svh] items-center justify-center py-16 text-center">
            <div className="max-w-xl">
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Film />
                </div>
                <p className="mb-3 text-sm font-semibold text-primary">404</p>
                <h1 className="text-4xl font-bold">لم نعثر على هذه الصفحة</h1>
                <p className="mt-4 leading-7 text-muted-foreground">
                    ربما تغير الرابط أو لم تتم إضافة هذا العمل إلى الأرشيف بعد.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button asChild>
                        <Link href="/">الصفحة الرئيسية</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/movies">تصفح الأفلام</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
