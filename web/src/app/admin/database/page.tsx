"use client"

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react"
import {
  Database,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TableProperties,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  adminApi,
  type AdminDatabaseColumn,
  type AdminDatabaseEntity,
  type AdminDatabaseRowsResponse,
} from "@/lib/adminApi"
import { cn } from "@/lib/utils"

type RowRecord = Record<string, unknown>
type DialogMode = "create" | "edit"

const pageSize = 20

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—"
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False"
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function summarizeValue(value: unknown) {
  const nextValue = stringifyValue(value)
  return nextValue.length > 72 ? `${nextValue.slice(0, 69)}...` : nextValue
}

function buildRowKey(entity: AdminDatabaseEntity, row: RowRecord) {
  return Object.fromEntries(entity.primaryKey.map((field) => [field, row[field]]))
}

function samePrimaryKey(left: Record<string, unknown> | null, right: Record<string, unknown> | null) {
  if (!left || !right) {
    return false
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

function getInputValue(column: AdminDatabaseColumn, value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (column.input === "boolean") {
    return Boolean(value)
  }

  if (column.input === "datetime") {
    const stringValue = String(value)
    if (stringValue.includes("T")) {
      return stringValue.slice(0, 16)
    }
    return stringValue.replace(" ", "T").slice(0, 16)
  }

  return String(value)
}

function createDraft(entity: AdminDatabaseEntity, row?: RowRecord | null) {
  return Object.fromEntries(
    entity.columns
      .filter((column) => (row ? column.editableOnUpdate : column.editableOnCreate))
      .map((column) => [column.name, getInputValue(column, row?.[column.name])])
  )
}

export default function AdminDatabasePage() {
  const [entities, setEntities] = useState<AdminDatabaseEntity[]>([])
  const [selectedEntityKey, setSelectedEntityKey] = useState<string>("")
  const [rowsPayload, setRowsPayload] = useState<AdminDatabaseRowsResponse | null>(null)
  const [loadingEntities, setLoadingEntities] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [offset, setOffset] = useState(0)
  const [selectedPrimaryKey, setSelectedPrimaryKey] = useState<Record<string, unknown> | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("create")
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [isSelectingEntity, startEntityTransition] = useTransition()

  useEffect(() => {
    void loadEntities()
  }, [])

  useEffect(() => {
    if (!selectedEntityKey) {
      return
    }

    void loadRows(selectedEntityKey)
  }, [selectedEntityKey, deferredSearch, offset])

  async function loadEntities() {
    setLoadingEntities(true)
    setError(null)

    try {
      const response = await adminApi.getDatabaseEntities()
      setEntities(response.entities)

      if (!selectedEntityKey && response.entities.length > 0) {
        const preferred = response.entities.find((entity) => entity.key === "movies") || response.entities[0]
        setSelectedEntityKey(preferred.key)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load database entities.")
    } finally {
      setLoadingEntities(false)
    }
  }

  async function loadRows(entityKey: string) {
    setLoadingRows(true)
    setError(null)

    try {
      const selectedEntity = entities.find((candidate) => candidate.key === entityKey)
      const response = await adminApi.getDatabaseRows(entityKey, {
        limit: pageSize,
        offset,
        search: deferredSearch,
        orderBy: rowsPayload?.entity.key === entityKey ? rowsPayload.orderBy : selectedEntity?.defaultSort.field,
        direction: rowsPayload?.entity.key === entityKey ? rowsPayload.direction : selectedEntity?.defaultSort.direction,
      })

      setRowsPayload(response)

      if (selectedPrimaryKey) {
        const stillExists = response.rows.some((row) => samePrimaryKey(buildRowKey(response.entity, row), selectedPrimaryKey))
        if (!stillExists) {
          setSelectedPrimaryKey(response.rows[0] ? buildRowKey(response.entity, response.rows[0]) : null)
        }
      } else {
        setSelectedPrimaryKey(response.rows[0] ? buildRowKey(response.entity, response.rows[0]) : null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load rows.")
      setRowsPayload(null)
    } finally {
      setLoadingRows(false)
    }
  }

  const selectedEntity = rowsPayload?.entity || entities.find((entity) => entity.key === selectedEntityKey) || null
  const visibleColumns = useMemo(() => {
    if (!selectedEntity) {
      return []
    }

    const previewSet = new Set(selectedEntity.previewColumns)
    return selectedEntity.columns
      .filter((column) => column.tableVisible)
      .sort((left, right) => {
        const leftScore = previewSet.has(left.name) ? 0 : 1
        const rightScore = previewSet.has(right.name) ? 0 : 1
        if (leftScore !== rightScore) {
          return leftScore - rightScore
        }
        return left.name.localeCompare(right.name)
      })
      .slice(0, 7)
  }, [selectedEntity])

  const selectedRow = useMemo(() => {
    if (!rowsPayload || !selectedPrimaryKey) {
      return null
    }

    return rowsPayload.rows.find((row) => samePrimaryKey(buildRowKey(rowsPayload.entity, row), selectedPrimaryKey)) || null
  }, [rowsPayload, selectedPrimaryKey])

  const mutableEntityCount = entities.filter((entity) => !entity.readOnly).length
  const totalRows = entities.reduce((sum, entity) => sum + (entity.count || 0), 0)

  function openCreateDialog() {
    if (!selectedEntity || selectedEntity.readOnly) {
      return
    }

    setDialogMode("create")
    setDraft(createDraft(selectedEntity))
    setDialogOpen(true)
  }

  function openEditDialog(row: RowRecord) {
    if (!selectedEntity || selectedEntity.readOnly) {
      return
    }

    setDialogMode("edit")
    setSelectedPrimaryKey(buildRowKey(selectedEntity, row))
    setDraft(createDraft(selectedEntity, row))
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!selectedEntity) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (dialogMode === "create") {
        await adminApi.createDatabaseRow(selectedEntity.key, draft)
      } else if (selectedPrimaryKey) {
        await adminApi.updateDatabaseRow(selectedEntity.key, selectedPrimaryKey, draft)
      }

      setDialogOpen(false)
      await loadEntities()
      await loadRows(selectedEntity.key)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save row.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: RowRecord) {
    if (!selectedEntity || selectedEntity.readOnly) {
      return
    }

    const rowKey = buildRowKey(selectedEntity, row)
    const confirmed = window.confirm(`Delete this ${selectedEntity.label.toLowerCase()} row?`)
    if (!confirmed) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await adminApi.deleteDatabaseRow(selectedEntity.key, rowKey)
      if (samePrimaryKey(selectedPrimaryKey, rowKey)) {
        setSelectedPrimaryKey(null)
      }
      await loadEntities()
      await loadRows(selectedEntity.key)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete row.")
    } finally {
      setSaving(false)
    }
  }

  function handleSort(columnName: string) {
    if (!rowsPayload) {
      return
    }

    const nextDirection =
      rowsPayload.orderBy === columnName && rowsPayload.direction === "ASC" ? "DESC" : "ASC"

    setRowsPayload({
      ...rowsPayload,
      orderBy: columnName,
      direction: nextDirection,
    })

    void adminApi
      .getDatabaseRows(rowsPayload.entity.key, {
        limit: pageSize,
        offset,
        search: deferredSearch,
        orderBy: columnName,
        direction: nextDirection,
      })
      .then((response) => {
        setRowsPayload(response)
      })
      .catch((sortError) => {
        setError(sortError instanceof Error ? sortError.message : "Failed to sort rows.")
      })
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(140deg,rgba(10,10,12,0.94),rgba(20,18,24,0.94)_55%,rgba(36,18,10,0.84))]">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.25fr)_360px] lg:px-8">
          <div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Database Studio
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Manage the real ElFilm schema instead of a thin admin subset.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              This workspace introspects the current D1 shape, including join tables, watch links, news, search
              surfaces, and persisted runtime settings. It is designed to keep the archive operational as the schema
              evolves.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => void loadEntities()} disabled={loadingEntities || loadingRows}>
                <RefreshCw className={cn("h-4 w-4", (loadingEntities || loadingRows) && "animate-spin")} />
                Refresh schema
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={openCreateDialog}
                disabled={!selectedEntity || selectedEntity.readOnly}
              >
                <Plus className="h-4 w-4" />
                Add row
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Card className="rounded-[24px] border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-[0.24em] text-zinc-400">
                  Managed tables
                </CardDescription>
                <CardTitle className="text-3xl text-white">{loadingEntities ? "..." : entities.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-zinc-400">Canonical archive, admin, and derived runtime surfaces.</p>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-[0.24em] text-zinc-400">
                  Mutable surfaces
                </CardDescription>
                <CardTitle className="text-3xl text-white">{loadingEntities ? "..." : mutableEntityCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-zinc-400">Tables editors can add to, revise, and clean directly.</p>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-[0.24em] text-zinc-400">
                  Indexed rows
                </CardDescription>
                <CardTitle className="text-3xl text-white">{loadingEntities ? "..." : totalRows.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-zinc-400">Row counts refresh from the actual database at runtime.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[22px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-primary" />
              Entity map
            </CardTitle>
            <CardDescription>Choose a table and work directly with its current schema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingEntities ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-[20px] bg-white/5" />
                ))}
              </div>
            ) : (
              entities.map((entity) => {
                const active = entity.key === selectedEntityKey

                return (
                  <button
                    key={entity.key}
                    type="button"
                    onClick={() =>
                      startEntityTransition(() => {
                        setSelectedEntityKey(entity.key)
                        setOffset(0)
                        setSearch("")
                        setRowsPayload(null)
                        setSelectedPrimaryKey(null)
                      })
                    }
                    className={cn(
                      "w-full rounded-[22px] border px-4 py-4 text-left transition-all",
                      active
                        ? "border-primary/30 bg-primary/10"
                        : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/8"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{entity.label}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{entity.description}</p>
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-black/20 text-muted-foreground">
                        {(entity.count || 0).toLocaleString()}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>PK: {entity.primaryKey.join(", ")}</span>
                      {entity.readOnly ? (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                          Read only
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/10 bg-black/25">
            <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-xl">
                  {selectedEntity ? selectedEntity.label : "Choose a table"}
                </CardTitle>
                <CardDescription>
                  {selectedEntity
                    ? selectedEntity.description
                    : "Select an entity on the left to inspect rows, schema, and write controls."}
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <div className="relative min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setOffset(0)
                    }}
                    placeholder={selectedEntity ? `Search ${selectedEntity.label.toLowerCase()}` : "Search rows"}
                    className="pl-9"
                    disabled={!selectedEntity}
                  />
                </div>
                <Button onClick={openCreateDialog} disabled={!selectedEntity || selectedEntity.readOnly}>
                  <Plus className="h-4 w-4" />
                  Add row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEntity?.readOnly && selectedEntity.readOnlyReason ? (
                <div className="rounded-[20px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {selectedEntity.readOnlyReason}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[24px] border border-white/10">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent">
                      {visibleColumns.map((column) => (
                        <TableHead key={column.name}>
                          <button
                            type="button"
                            onClick={() => handleSort(column.name)}
                            className="inline-flex items-center gap-2 text-left"
                          >
                            {column.label}
                            {rowsPayload?.orderBy === column.name ? (
                              <span className="text-[10px] uppercase tracking-[0.2em] text-primary">
                                {rowsPayload.direction}
                              </span>
                            ) : null}
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRows || isSelectingEntity ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 1} className="h-32 text-center text-muted-foreground">
                          Loading rows...
                        </TableCell>
                      </TableRow>
                    ) : rowsPayload?.rows.length ? (
                      rowsPayload.rows.map((row) => {
                        const rowKey = selectedEntity ? buildRowKey(selectedEntity, row) : null
                        const active = samePrimaryKey(rowKey, selectedPrimaryKey)

                        return (
                          <TableRow
                            key={JSON.stringify(rowKey)}
                            className={cn("cursor-pointer", active && "bg-white/5")}
                            onClick={() => setSelectedPrimaryKey(rowKey)}
                          >
                            {visibleColumns.map((column) => (
                              <TableCell key={column.name} className="max-w-[240px] align-top">
                                <div className="space-y-1">
                                  <span className="block break-words text-sm text-foreground">
                                    {summarizeValue(row[column.name])}
                                  </span>
                                  {column.primaryKey ? (
                                    <span className="text-[10px] uppercase tracking-[0.22em] text-primary">Primary key</span>
                                  ) : null}
                                </div>
                              </TableCell>
                            ))}
                            <TableCell className="w-[150px]">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openEditDialog(row)
                                  }}
                                  disabled={selectedEntity?.readOnly}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleDelete(row)
                                  }}
                                  disabled={selectedEntity?.readOnly || saving}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 1} className="h-32 text-center text-muted-foreground">
                          No rows matched this query.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {rowsPayload
                    ? `${Math.min(rowsPayload.total, rowsPayload.offset + 1)}-${Math.min(
                        rowsPayload.total,
                        rowsPayload.offset + rowsPayload.rows.length
                      )} of ${rowsPayload.total.toLocaleString()} rows`
                    : "No table selected"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
                    disabled={offset === 0 || loadingRows}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOffset((current) => current + pageSize)}
                    disabled={!rowsPayload || offset + pageSize >= rowsPayload.total || loadingRows}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="rounded-[28px] border-white/10 bg-black/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TableProperties className="h-5 w-5 text-primary" />
                  Field catalog
                </CardTitle>
                <CardDescription>Current columns returned by the database for this entity.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {selectedEntity?.columns.map((column) => (
                  <div key={column.name} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{column.label}</p>
                      <Badge variant="outline" className="border-white/10 bg-black/20 text-muted-foreground">
                        {column.dbType || column.input}
                      </Badge>
                      {column.primaryKey ? (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          PK
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{column.name}</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {column.description || `Create: ${column.editableOnCreate ? "yes" : "no"} · Update: ${column.editableOnUpdate ? "yes" : "no"}`}
                    </p>
                  </div>
                )) || (
                  <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    Select an entity to inspect its columns.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/10 bg-black/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Selected row
                </CardTitle>
                <CardDescription>Row key and full-value preview for the current selection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEntity && selectedRow ? (
                  <>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Primary key</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(buildRowKey(selectedEntity, selectedRow)).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="border-white/10 bg-black/20 text-foreground">
                            {key}: {stringifyValue(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedEntity.columns.map((column) => (
                        <div key={column.name} className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{column.label}</p>
                          <p className="mt-2 break-words text-sm leading-6 text-foreground">
                            {stringifyValue(selectedRow[column.name])}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    Pick a row in the grid to inspect it here.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-hidden border-white/10 bg-zinc-950 text-foreground sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? `Add ${selectedEntity?.label || "row"}` : `Edit ${selectedEntity?.label || "row"}`}
            </DialogTitle>
            <DialogDescription>
              {selectedEntity?.description || "Modify the selected row using the live schema."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[64svh] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
            {selectedEntity?.columns
              .filter((column) => (dialogMode === "create" ? column.editableOnCreate : column.editableOnUpdate))
              .map((column) => (
                <div key={column.name} className={cn("space-y-2", column.input === "textarea" && "md:col-span-2")}>
                  <Label htmlFor={column.name}>
                    {column.label}
                    {column.required ? <span className="ml-1 text-rose-400">*</span> : null}
                  </Label>
                  {column.input === "textarea" ? (
                    <textarea
                      id={column.name}
                      value={String(draft[column.name] ?? "")}
                      onChange={(event) => setDraft((current) => ({ ...current, [column.name]: event.target.value }))}
                      rows={6}
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  ) : column.input === "boolean" ? (
                    <div className="flex min-h-10 items-center rounded-md border border-input px-3">
                      <Switch
                        checked={Boolean(draft[column.name])}
                        onCheckedChange={(checked) => setDraft((current) => ({ ...current, [column.name]: checked }))}
                      />
                    </div>
                  ) : (
                    <Input
                      id={column.name}
                      type={
                        column.input === "integer" || column.input === "real"
                          ? "number"
                          : column.input === "date"
                            ? "date"
                            : column.input === "datetime"
                              ? "datetime-local"
                              : column.input === "url"
                                ? "url"
                                : "text"
                      }
                      step={column.input === "real" ? "0.01" : undefined}
                      value={String(draft[column.name] ?? "")}
                      onChange={(event) => setDraft((current) => ({ ...current, [column.name]: event.target.value }))}
                    />
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {column.description || `${column.name} · ${column.dbType || column.input}`}
                  </p>
                </div>
              ))}
          </div>

          <DialogFooter className="border-t border-white/10 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : dialogMode === "create" ? "Create row" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
