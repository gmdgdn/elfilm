"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { adminApi, type AdminSettings } from "@/lib/adminApi"

const defaultSettings: AdminSettings = {
  maintenanceMode: false,
  debugMode: false,
  publicRegistration: false,
  cacheTtl: 3600,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await adminApi.getSettings()
      setSettings(response.settings)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await adminApi.updateSettings(settings)
      setSettings(response.settings)
      setMessage("Settings saved to D1.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(140deg,rgba(10,10,12,0.94),rgba(20,18,24,0.94)_55%,rgba(20,26,36,0.84))]">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">System settings</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Runtime controls are now persisted in D1 through the admin API, so operational defaults survive deploys.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void loadSettings()} disabled={loading || saving}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => void handleSave()} disabled={loading || saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[22px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader>
            <CardTitle>Operational controls</CardTitle>
            <CardDescription>Toggle the archive runtime behavior without leaving the admin console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="space-y-1">
                <Label className="text-base">Maintenance mode</Label>
                <p className="text-sm text-muted-foreground">Pause public traffic while data repairs or imports are running.</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => setSettings((current) => ({ ...current, maintenanceMode: checked }))}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="space-y-1">
                <Label className="text-base">Debug mode</Label>
                <p className="text-sm text-muted-foreground">Capture deeper diagnostics for admin-side troubleshooting.</p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => setSettings((current) => ({ ...current, debugMode: checked }))}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="space-y-1">
                <Label className="text-base">Public registration</Label>
                <p className="text-sm text-muted-foreground">Reserve the switch for future public contributor workflows.</p>
              </div>
              <Switch
                checked={settings.publicRegistration}
                onCheckedChange={(checked) => setSettings((current) => ({ ...current, publicRegistration: checked }))}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader>
            <CardTitle>Cache policy</CardTitle>
            <CardDescription>Persisted defaults for archive response freshness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ttl">Default cache TTL (seconds)</Label>
              <Input
                id="ttl"
                type="number"
                min={0}
                value={settings.cacheTtl}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    cacheTtl: Number.parseInt(event.target.value || "0", 10) || 0,
                  }))
                }
                disabled={loading}
              />
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
              These values are stored in the new <code>system_settings</code> table, so they can also be inspected from
              the database studio.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
