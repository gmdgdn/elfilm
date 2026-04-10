"use client"

import * as React from "react"

import { PersonCard } from "@/components/features/person-card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Person } from "@/lib/api"

export function DiedOnThisDay() {
    const [people, setPeople] = React.useState<Person[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    React.useEffect(() => {
        const fetchPeople = async () => {
            try {
                const today = new Date()
                const data = await api.getPeopleDiedOn(today.getMonth() + 1, today.getDate())
                setPeople(data.people)
            } catch (error) {
                console.error("Failed to fetch people died on this day:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPeople()
    }, [])

    if (!isLoading && people.length === 0) {
        return null
    }

    return (
        <section className="mt-12">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">ذكرى الرحيل</h2>
                <span className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
                </span>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <Skeleton className="aspect-[2/3] rounded-lg" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {people.map((person) => (
                        <PersonCard
                            key={person.id}
                            id={person.id}
                            slug={person.slug || person.id}
                            name={person.name_ar || person.name_en || "Unknown"}
                            role={person.deathdate ? new Date(person.deathdate).getFullYear().toString() : undefined}
                            imageUrl={person.profile_image}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}
