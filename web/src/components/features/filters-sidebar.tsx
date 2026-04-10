"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"

interface FiltersSidebarProps {
    type: 'movies' | 'people'
    genres?: { id: number; name: string }[]
}

export function FiltersSidebar({ type, genres = [] }: FiltersSidebarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // State for filters
    const [yearRange, setYearRange] = React.useState([1920, 2025])
    const [selectedGenre, setSelectedGenre] = React.useState<string>(searchParams.get('genreId') || 'all')
    const [sortBy, setSortBy] = React.useState<string>(searchParams.get('orderBy') || (type === 'movies' ? 'year' : 'name_ar'))
    const [sortDir, setSortDir] = React.useState<string>(searchParams.get('direction') || (type === 'movies' ? 'DESC' : 'ASC'))

    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString())

        // Year Range (only for movies)
        if (type === 'movies') {
            params.set('yearMin', yearRange[0].toString())
            params.set('yearMax', yearRange[1].toString())
        }

        // Genre (only for movies)
        if (type === 'movies' && selectedGenre !== 'all') {
            params.set('genreId', selectedGenre)
        } else {
            params.delete('genreId')
        }

        // Sorting
        params.set('orderBy', sortBy)
        params.set('direction', sortDir)

        // Reset page
        params.delete('page')

        router.push(`/${type}?${params.toString()}`)
    }

    return (
        <div className="space-y-6 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold">تصفية النتائج</h3>
                <Button variant="ghost" size="sm" onClick={applyFilters}>
                    تطبيق
                </Button>
            </div>

            <Separator />

            {/* Sort By */}
            <div className="space-y-3">
                <Label>الترتيب حسب</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {type === 'movies' ? (
                            <>
                                <SelectItem value="year">سنة الإنتاج</SelectItem>
                                <SelectItem value="rating">التقييم</SelectItem>
                                <SelectItem value="title">العنوان</SelectItem>
                            </>
                        ) : (
                            <>
                                <SelectItem value="name_ar">الاسم</SelectItem>
                                <SelectItem value="birthdate">تاريخ الميلاد</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>

                <RadioGroup value={sortDir} onValueChange={setSortDir} className="flex gap-4">
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="ASC" id="asc" />
                        <Label htmlFor="asc">تصاعدي</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="DESC" id="desc" />
                        <Label htmlFor="desc">تنازلي</Label>
                    </div>
                </RadioGroup>
            </div>

            {type === 'movies' && (
                <>
                    <Separator />

                    {/* Year Range */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>سنة الإنتاج</Label>
                            <span className="text-sm text-muted-foreground">
                                {yearRange[0]} - {yearRange[1]}
                            </span>
                        </div>
                        <Slider
                            defaultValue={[1920, 2025]}
                            min={1920}
                            max={2025}
                            step={1}
                            value={yearRange}
                            onValueChange={setYearRange}
                            className="py-4"
                        />
                    </div>

                    <Separator />

                    {/* Genres */}
                    {genres.length > 0 && (
                        <div className="space-y-3">
                            <Label>التصنيف</Label>
                            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر التصنيف" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">الكل</SelectItem>
                                    {genres.map(genre => (
                                        <SelectItem key={genre.id} value={genre.id.toString()}>
                                            {genre.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
