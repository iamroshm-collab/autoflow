"use client"

import { useEffect, useMemo, useState } from "react"
import { CONFIG } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RefreshCw, Plus, Search } from "lucide-react"
import { notify } from "@/components/ui/notify"
import DatePickerInput from "@/components/ui/date-picker-input"
import { formatDateDDMMYY } from "@/lib/utils"

export type NoteEntry = {
  id: string
  noteNumber: string
  date: string
  party: string
  reference: string
  amount: number
  taxRate: number
  reason: string
  gstin?: string
}

const currency = (value: number) => `₹${value.toFixed(2)}`

const shopStateCode = (CONFIG.SHOP.GSTIN || "").slice(0, 2) || "00"

const deriveStateCode = (gstin?: string) => {
  const code = (gstin || "").trim().slice(0, 2)
  return code && /^\d{2}$/.test(code) ? code : "00"
}

const NoteForm = ({
  onAdd,
  defaultTaxRate,
  label,
  entries,
}: {
  onAdd: (entry: NoteEntry) => Promise<void> | void
  defaultTaxRate: number
  label: "Credit" | "Debit"
  entries: NoteEntry[]
}) => {
  const today = formatDateDDMMYY(new Date())
  const [form, setForm] = useState({
    noteNumber: "",
    date: today,
    party: "",
    reference: "",
    amount: "",
    taxRate: String(defaultTaxRate),
    reason: "",
    gstin: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHighlight, setSearchHighlight] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return entries.slice(0, 50)
    return entries.filter((entry) => {
      const haystack = `${entry.noteNumber} ${entry.party} ${entry.reference} ${entry.reason} ${entry.date}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, searchQuery])

  useEffect(() => {
    if (!isSearchOpen) return
    setSearchHighlight((prev) => {
      const max = Math.max(0, filteredEntries.length - 1)
      return Math.min(prev, max)
    })
  }, [filteredEntries.length, isSearchOpen])

  const loadEntryToForm = (entry: NoteEntry) => {
    setForm({
      noteNumber: entry.noteNumber,
      date: entry.date,
      party: entry.party,
      reference: entry.reference,
      amount: String(entry.amount),
      taxRate: String(entry.taxRate),
      reason: entry.reason,
      gstin: entry.gstin || "",
    })
    setIsSearchOpen(false)
    setIsNewModalOpen(true)
  }

  const handleSubmit = async () => {
    const amount = Number(form.amount || 0)
    const taxRate = Number(form.taxRate || 0)

    if (!form.noteNumber.trim() || !form.party.trim()) {
      notify.error(`${label} note number and party are required`)
      return
    }

    if (Number.isNaN(amount) || amount <= 0) {
      notify.error("Enter a valid amount")
      return
    }
    setSubmitting(true)
    try {
      const entry: NoteEntry = {
        id: `${label}-${Date.now()}`,
        noteNumber: form.noteNumber.trim(),
        date: form.date,
        party: form.party.trim(),
        reference: form.reference.trim(),
        amount,
        taxRate,
        reason: form.reason.trim(),
        gstin: form.gstin.trim() || undefined,
      }

      await onAdd(entry)
      setForm({
        noteNumber: "",
        date: today,
        party: "",
        reference: "",
        amount: "",
        taxRate: String(defaultTaxRate),
        reason: "",
        gstin: "",
      })
      setIsNewModalOpen(false)
    } catch (error) {
      console.error("Failed to add note", error)
      notify.error("Failed to add note")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-0 bg-transparent p-0 shadow-none">
      <div className="mb-4 flex items-center justify-end gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchHighlight(0)
              setIsSearchOpen(true)
            }}
            onKeyDown={(e) => {
              if (!isSearchOpen) return
              if (filteredEntries.length === 0) return
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setSearchHighlight((h) => Math.min(h + 1, filteredEntries.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setSearchHighlight((h) => Math.max(h - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                const selected = filteredEntries[searchHighlight]
                if (selected) loadEntryToForm(selected)
              } else if (e.key === "Escape") {
                e.preventDefault()
                setIsSearchOpen(false)
              }
            }}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 120)}
            placeholder={`Search by note #, party, reference, date, reason...`}
            className="pl-9"
          />

          {isSearchOpen && (
            <div className="dropdown-container">
              <div className="dropdown-scroll">
                {filteredEntries.length === 0 ? (
                  <div className="dropdown-empty-state">No notes found.</div>
                ) : (
                  filteredEntries.map((entry, idx) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`dropdown-item ${idx === searchHighlight ? "selected" : ""}`}
                      onMouseDown={() => loadEntryToForm(entry)}
                      onMouseEnter={() => setSearchHighlight(idx)}
                    >
                      <span className="font-medium">{entry.noteNumber}</span>
                      <span className="ml-2 text-xs text-slate-400">{entry.party}</span>
                      <span className="ml-2 text-xs text-slate-400">{entry.date}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-[46rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Add {label} Note</DialogTitle>
            <DialogDescription>Fill note details and save.</DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${label}-noteNumber`}>Note Number</Label>
                <Input
                  id={`${label}-noteNumber`}
                  placeholder={`${label === "Credit" ? "CN" : "DN"}-001`}
                  value={form.noteNumber}
                  onChange={(e) => setForm((p) => ({ ...p, noteNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${label}-date`}>Date</Label>
                <DatePickerInput
                  id={`${label}-date`}
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e }))}
                  format="dd-mm-yy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${label}-party`}>Customer / Supplier</Label>
                <Input
                  id={`${label}-party`}
                  placeholder="Party name"
                  value={form.party}
                  onChange={(e) => setForm((p) => ({ ...p, party: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${label}-reference`}>Reference Invoice</Label>
                <Input
                  id={`${label}-reference`}
                  placeholder="INV-123"
                  value={form.reference}
                  onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${label}-amount`}>Taxable Amount</Label>
                <Input
                  id={`${label}-amount`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${label}-taxRate`}>GST %</Label>
                <Select
                  value={form.taxRate}
                  onValueChange={(v) => setForm((p) => ({ ...p, taxRate: v }))}
                >
                  <SelectTrigger id={`${label}-taxRate`}>
                    <SelectValue placeholder="Select GST %" />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3 space-y-2">
                <Label htmlFor={`${label}-reason`}>Reason / Notes</Label>
                <Textarea
                  id={`${label}-reason`}
                  rows={2}
                  placeholder="Return, rate revision, damage adjustment, etc."
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${label}-gstin`}>GSTIN (optional)</Label>
                <Input
                  id={`${label}-gstin`}
                  placeholder="29ABCDE1234F2Z5"
                  value={form.gstin}
                  onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="sticky-form-actions flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsNewModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : `Save ${label} Note`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-4 inventory-pos-table-wrapper">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead>Note #</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST %</TableHead>
              <TableHead className="text-right">GST Amt</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                  No entries yet. Add a note to get started.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => {
              const gstAmount = (entry.amount * entry.taxRate) / 100
              const isIntra = deriveStateCode(entry.gstin) === shopStateCode
              const cgst = isIntra ? gstAmount / 2 : 0
              const sgst = isIntra ? gstAmount / 2 : 0
              const igst = isIntra ? 0 : gstAmount
              return (
                <TableRow key={entry.id}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.noteNumber}</TableCell>
                  <TableCell>{entry.party}</TableCell>
                  <TableCell>{entry.reference || "-"}</TableCell>
                  <TableCell className="text-right">{currency(entry.amount)}</TableCell>
                  <TableCell className="text-right">{entry.taxRate}%</TableCell>
                  <TableCell className="text-right">{currency(gstAmount)}</TableCell>
                  <TableCell className="text-right">{currency(cgst)}</TableCell>
                  <TableCell className="text-right">{currency(sgst)}</TableCell>
                  <TableCell className="text-right">{currency(igst)}</TableCell>
                  <TableCell className="max-w-xs truncate" title={entry.reason}>
                    {entry.reason || "-"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="shrink-0 mt-4">
        <Button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="global-bottom-btn-add"
          variant="ghost"
        >
          <Plus className="h-4 w-4 mr-2" />
          New {label} Note
        </Button>
      </div>
    </Card>
  )
}

const NoteSummary = ({ title, entries }: { title: string; entries: NoteEntry[] }) => {
  const totals = useMemo(() => {
    const taxable = entries.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const gst = entries.reduce(
      (sum, row) => sum + ((Number(row.amount || 0) * Number(row.taxRate || 0)) / 100),
      0,
    )
    return { taxable, gst }
  }, [entries])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-slate-50">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{title} Count</div>
          <div className="text-2xl font-semibold">{entries.length}</div>
        </CardContent>
      </Card>
      <Card className="bg-emerald-50">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Taxable Total</div>
          <div className="text-2xl font-semibold text-emerald-700">{currency(totals.taxable)}</div>
        </CardContent>
      </Card>
      <Card className="bg-orange-50">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">GST Amount</div>
          <div className="text-2xl font-semibold text-orange-700">{currency(totals.gst)}</div>
        </CardContent>
      </Card>
      <Card className="bg-sky-50">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Gross w/ GST</div>
          <div className="text-2xl font-semibold text-sky-700">{currency(totals.taxable + totals.gst)}</div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CreditNoteTab({ entries, onAdd }: { entries: NoteEntry[]; onAdd: (entry: NoteEntry) => void }) {
  return (
    <div className="space-y-4">
      <NoteForm onAdd={onAdd} defaultTaxRate={18} label="Credit" entries={entries} />
    </div>
  )
}

export function DebitNoteTab({ entries, onAdd }: { entries: NoteEntry[]; onAdd: (entry: NoteEntry) => void }) {
  return (
    <div className="space-y-4">
      <NoteForm onAdd={onAdd} defaultTaxRate={18} label="Debit" entries={entries} />
    </div>
  )
}

type Gstr1Row = {
  billNumber: string
  billDate: string
  customer: string
  customerGstin?: string | null
  placeOfSupplyStateCode?: string | null
  totalTaxableAmount: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  grandTotal: number
}

type Gstr1Payload = {
  b2bInvoices: Gstr1Row[]
  b2cLarge: Gstr1Row[]
  b2cSmall: { placeOfSupplyStateCode: string | null; _sum: Partial<Record<keyof Gstr1Row, number>> }[]
  taxLiability: { taxable: number; cgst: number; sgst: number; igst: number; gross: number }
}

export function GstReportTab({ creditNotes, debitNotes }: { creditNotes: NoteEntry[]; debitNotes: NoteEntry[] }) {
  const [filters, setFilters] = useState({ startDate: "", endDate: "" })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Gstr1Payload | null>(null)

  const fetchReport = async (range: { startDate: string; endDate: string }) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (range.startDate) params.append("startDate", range.startDate)
      if (range.endDate) params.append("endDate", range.endDate)
      const res = await fetch(`/api/reports/gstr1?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load GST report")
      const data = (await res.json()) as Gstr1Payload
      setReport(data)
    } catch (err) {
      console.error("[GST_REPORT_TAB]", err)
      setError("Failed to load GST report. Please retry.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(filters)
  }, [])

  const handleLoad = () => fetchReport(filters)

  const exportCsv = () => {
    if (!report) return
    const lines: string[] = []

    const push = (row: (string | number | null | undefined)[]) => {
      lines.push(row.map((cell) => {
        if (cell === null || cell === undefined) return ""
        const str = String(cell)
        return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str
      }).join(","))
    }

    push(["Section", "Bill #", "Date", "Party/State", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Grand Total"])

    report.b2bInvoices.forEach((row) => {
      push(["B2B", row.billNumber, formatDateDDMMYY(row.billDate), row.customer, row.customerGstin, row.totalTaxableAmount, row.totalCgst, row.totalSgst, row.totalIgst, row.grandTotal])
    })

    report.b2cLarge.forEach((row) => {
      push(["B2C Large", row.billNumber, formatDateDDMMYY(row.billDate), row.placeOfSupplyStateCode, "", row.totalTaxableAmount, row.totalCgst, row.totalSgst, row.totalIgst, row.grandTotal])
    })

    report.b2cSmall.forEach((row) => {
      push(["B2C Small", "-", "-", row.placeOfSupplyStateCode, "", row._sum.totalTaxableAmount || 0, row._sum.totalCgst || 0, row._sum.totalSgst || 0, row._sum.totalIgst || 0, row._sum.grandTotal || 0])
    })

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "gstr1-report.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const noteRows = useMemo(() => {
    const mapRow = (entry: NoteEntry, type: "Credit" | "Debit") => {
      const taxable = Number(entry.amount || 0)
      const gst = (taxable * Number(entry.taxRate || 0)) / 100
      const isIntra = deriveStateCode(entry.gstin) === shopStateCode
      const cgst = isIntra ? gst / 2 : 0
      const sgst = isIntra ? gst / 2 : 0
      const igst = isIntra ? 0 : gst
      return {
        id: `${type}-${entry.id}`,
        type,
        date: entry.date,
        noteNumber: entry.noteNumber,
        party: entry.party,
        reference: entry.reference,
        taxable,
        gst,
        cgst,
        sgst,
        igst,
        gstin: entry.gstin || "N/A",
        stateCode: deriveStateCode(entry.gstin),
      }
    }
    return [...creditNotes.map((r) => mapRow(r, "Credit")), ...debitNotes.map((r) => mapRow(r, "Debit"))]
  }, [creditNotes, debitNotes])

  const filteredNotes = useMemo(() => {
    const start = filters.startDate ? new Date(filters.startDate) : null
    const end = filters.endDate ? new Date(filters.endDate) : null
    return noteRows.filter((row) => {
      const rowDate = new Date(row.date)
      const afterStart = start ? rowDate >= start : true
      const beforeEnd = end ? rowDate <= end : true
      return afterStart && beforeEnd
    })
  }, [noteRows, filters])

  const noteTotals = useMemo(() => {
    const creditTaxable = filteredNotes.filter((r) => r.type === "Credit").reduce((sum, r) => sum + r.taxable, 0)
    const debitTaxable = filteredNotes.filter((r) => r.type === "Debit").reduce((sum, r) => sum + r.taxable, 0)
    const creditGst = filteredNotes.filter((r) => r.type === "Credit").reduce((sum, r) => sum + r.gst, 0)
    const debitGst = filteredNotes.filter((r) => r.type === "Debit").reduce((sum, r) => sum + r.gst, 0)
    const creditCgst = filteredNotes.filter((r) => r.type === "Credit").reduce((sum, r) => sum + r.cgst, 0)
    const debitCgst = filteredNotes.filter((r) => r.type === "Debit").reduce((sum, r) => sum + r.cgst, 0)
    const creditSgst = filteredNotes.filter((r) => r.type === "Credit").reduce((sum, r) => sum + r.sgst, 0)
    const debitSgst = filteredNotes.filter((r) => r.type === "Debit").reduce((sum, r) => sum + r.sgst, 0)
    const creditIgst = filteredNotes.filter((r) => r.type === "Credit").reduce((sum, r) => sum + r.igst, 0)
    const debitIgst = filteredNotes.filter((r) => r.type === "Debit").reduce((sum, r) => sum + r.igst, 0)
    return {
      creditTaxable,
      debitTaxable,
      creditGst,
      debitGst,
      netTaxable: creditTaxable - debitTaxable,
      netGst: creditGst - debitGst,
      creditCgst,
      debitCgst,
      netCgst: creditCgst - debitCgst,
      creditSgst,
      debitSgst,
      netSgst: creditSgst - debitSgst,
      creditIgst,
      debitIgst,
      netIgst: creditIgst - debitIgst,
    }
  }, [filteredNotes])

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-transparent p-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">GSTR-1 Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 items-end">
            <div className="space-y-2">
              <Label htmlFor="report-start">From</Label>
              <DatePickerInput id="report-start" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-end">To</Label>
              <DatePickerInput id="report-end" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e }))} />
            </div>
            <div className="flex gap-2">
              <Button className="w-full" onClick={handleLoad} disabled={loading}>
                {loading ? "Loading..." : "Load report"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => fetchReport({ startDate: "", endDate: "" })} disabled={loading}>
                Reset
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="w-full" onClick={exportCsv} disabled={!report || loading}>
                Export Excel (CSV)
              </Button>
            </div>
          </div>

          {loading && <div className="text-sm text-muted-foreground">Loading GST report...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {report && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">B2B Invoices</div>
                    <div className="text-2xl font-semibold text-blue-700">{report.b2bInvoices.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">B2C Large</div>
                    <div className="text-2xl font-semibold text-orange-700">{report.b2cLarge.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Taxable</div>
                    <div className="text-2xl font-semibold text-slate-700">{currency(report.taxLiability.taxable)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">GST (CGST+SGST)</div>
                    <div className="text-2xl font-semibold text-slate-700">{currency(report.taxLiability.cgst + report.taxLiability.sgst)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">IGST</div>
                    <div className="text-2xl font-semibold text-slate-700">{currency(report.taxLiability.igst)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">B2B</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>GSTIN</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.b2bInvoices.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No B2B invoices</TableCell></TableRow>
                        )}
                        {report.b2bInvoices.map((row) => (
                          <TableRow key={row.billNumber}>
                            <TableCell>{row.billNumber}</TableCell>
                            <TableCell>{formatDateDDMMYY(row.billDate)}</TableCell>
                            <TableCell>{row.customer}</TableCell>
                            <TableCell>{row.customerGstin || "-"}</TableCell>
                            <TableCell className="text-right">{currency(row.totalTaxableAmount || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalCgst || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalSgst || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalIgst || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">B2C Large (&gt; ₹2.5L)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.b2cLarge.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No B2C large invoices</TableCell></TableRow>
                        )}
                        {report.b2cLarge.map((row) => (
                          <TableRow key={row.billNumber}>
                            <TableCell>{row.billNumber}</TableCell>
                            <TableCell>{formatDateDDMMYY(row.billDate)}</TableCell>
                            <TableCell>{row.placeOfSupplyStateCode || "-"}</TableCell>
                            <TableCell className="text-right">{currency(row.totalTaxableAmount || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalCgst || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalSgst || 0)}</TableCell>
                            <TableCell className="text-right">{currency(row.totalIgst || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">B2C Small (by State)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Grand Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.b2cSmall.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No B2C small rows</TableCell></TableRow>
                      )}
                      {report.b2cSmall.map((row) => (
                        <TableRow key={row.placeOfSupplyStateCode || "NA"}>
                          <TableCell>{row.placeOfSupplyStateCode || "-"}</TableCell>
                          <TableCell className="text-right">{currency(row._sum.totalTaxableAmount || 0)}</TableCell>
                          <TableCell className="text-right">{currency(row._sum.totalCgst || 0)}</TableCell>
                          <TableCell className="text-right">{currency(row._sum.totalSgst || 0)}</TableCell>
                          <TableCell className="text-right">{currency(row._sum.totalIgst || 0)}</TableCell>
                          <TableCell className="text-right">{currency(row._sum.grandTotal || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent p-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Adjustment Notes (Credit / Debit)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-blue-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Credit Taxable</div>
                <div className="text-2xl font-semibold text-blue-700">{currency(noteTotals.creditTaxable)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Debit Taxable</div>
                <div className="text-2xl font-semibold text-red-700">{currency(noteTotals.debitTaxable)}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Net Taxable</div>
                <div className="text-2xl font-semibold text-emerald-700">{currency(noteTotals.netTaxable)}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Net GST</div>
                <div className="text-2xl font-semibold text-orange-700">{currency(noteTotals.netGst)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Net CGST</div>
                <div className="text-2xl font-semibold text-slate-700">{currency(noteTotals.netCgst)}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Net SGST</div>
                <div className="text-2xl font-semibold text-slate-700">{currency(noteTotals.netSgst)}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Net IGST</div>
                <div className="text-2xl font-semibold text-slate-700">{currency(noteTotals.netIgst)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="gst-start">From</Label>
                <DatePickerInput id="gst-start" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst-end">To</Label>
                <DatePickerInput id="gst-end" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e }))} />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="w-full" onClick={() => setFilters({ startDate: "", endDate: "" })}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
              <div className="flex items-end" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">GST Impact (Notes)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Note #</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                        No rows for the selected period.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredNotes.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.noteNumber}</TableCell>
                      <TableCell>{row.party}</TableCell>
                      <TableCell>{row.reference || "-"}</TableCell>
                      <TableCell>{row.gstin}</TableCell>
                      <TableCell className="text-right">{currency(row.taxable)}</TableCell>
                      <TableCell className="text-right">{currency(row.gst)}</TableCell>
                      <TableCell className="text-right">{currency(row.cgst)}</TableCell>
                      <TableCell className="text-right">{currency(row.sgst)}</TableCell>
                      <TableCell className="text-right">{currency(row.igst)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
