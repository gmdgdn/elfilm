"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Building2,
  ChevronRight,
  Clapperboard,
  Cloud,
  Database,
  FileClock,
  LayoutDashboard,
  Menu,
  Radar,
  Settings2,
  ShieldCheck,
  Tags,
  UsersRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface AdminShellProps {
  children: React.ReactNode
}

const navSections = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, detail: "Collections, activity, and system signals" },
      { href: "/admin/movies", label: "Movies", icon: Clapperboard, detail: "Archive titles, releases, and metadata" },
      { href: "/admin/people", label: "People", icon: UsersRound, detail: "Talent, crew, and contributor records" },
      { href: "/admin/companies", label: "Companies", icon: Building2, detail: "Studios, distributors, and partners" },
      { href: "/admin/taxonomy", label: "Taxonomy", icon: Tags, detail: "Genres, tags, and collection structure" },
      { href: "/admin/database", label: "Database", icon: Database, detail: "Every table, join surface, and runtime setting in D1" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/admin/vectorize", label: "Vector Search", icon: Radar, detail: "Embeddings, AI indexing, and retrieval" },
      { href: "/admin/audit-log", label: "Audit Log", icon: FileClock, detail: "Every write, import, and maintenance action" },
      { href: "/admin/settings", label: "Settings", icon: Settings2, detail: "Runtime controls and system defaults" },
    ],
  },
]

const platformSignals = [
  { icon: ShieldCheck, label: "Scoped admin surface", detail: "Protected API routes and action logging" },
  { icon: Bot, label: "AI-ready workflows", detail: "Vector indexing, automation, and future agent tooling" },
  { icon: Cloud, label: "Cloudflare runtime", detail: "Edge-ready operations for the ElFilm archive" },
]

function isActiveLink(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function AdminNavigation({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-sm font-semibold tracking-[0.3em] text-primary">
                EF
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">ElFilm Admin</p>
                <h1 className="mt-1 text-lg font-semibold text-foreground">Operations Console</h1>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              EmDash-inspired control surface for collections, auditability, and AI-assisted archive operations.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Collections-first
          </Badge>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Edge ready
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {navSections.map((section) => (
          <div key={section.label} className="mb-8">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {section.label}
            </p>
            <div className="mt-3 space-y-1.5">
              {section.items.map((item) => {
                const active = isActiveLink(pathname, item.href)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group block rounded-2xl border px-3 py-3 transition-all",
                      active
                        ? "border-primary/35 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                        : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          active
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-white/10 bg-background/50 text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{item.label}</span>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform",
                              active ? "text-primary" : "text-muted-foreground group-hover:translate-x-0.5"
                            )}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Platform Signals</p>
        <div className="mt-4 space-y-3">
          {platformSignals.map((signal) => {
            const Icon = signal.icon

            return (
              <div key={signal.label} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{signal.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{signal.detail}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname()

  return (
    <div
      dir="ltr"
      className="relative min-h-[calc(100svh-9rem)] overflow-hidden bg-[radial-gradient(circle_at_top_left,oklch(0.24_0.06_32_/0.35),transparent_28%),radial-gradient(circle_at_bottom_right,oklch(0.26_0.04_210_/0.32),transparent_24%)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0_/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0_/0.02)_1px,transparent_1px)] bg-[size:88px_88px]" />
      <div className="relative mx-auto flex w-full max-w-[1560px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-[calc(100svh-8.5rem)] w-80 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-black/45 backdrop-blur xl:block">
          <AdminNavigation pathname={pathname} />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/30 px-4 py-4 backdrop-blur sm:px-5">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="xl:hidden">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open admin navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[92vw] max-w-sm border-white/10 bg-zinc-950/98 p-0 text-foreground">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Admin navigation</SheetTitle>
                    <SheetDescription>Browse admin collections and operational tools.</SheetDescription>
                  </SheetHeader>
                  <AdminNavigation pathname={pathname} />
                </SheetContent>
              </Sheet>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Editorial Operations
                </p>
                <p className="mt-1 text-sm text-foreground">Collections, AI indexing, and archive stewardship</p>
              </div>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                EmDash cues applied
              </Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Cloudflare-ready
              </Badge>
            </div>
          </div>

          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
