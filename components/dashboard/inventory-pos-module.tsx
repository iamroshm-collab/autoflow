"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import PurchaseEntryForm from "@/components/inventory/purchase-entry-form"
import { POSSalesForm } from "@/components/inventory/pos-sales"
import { InventoryReportComponent } from "@/components/inventory/inventory-report"
import { InventoryMovementForm } from "@/components/inventory/InventoryMovementForm"
import { CreditNoteTab, DebitNoteTab, GstReportTab } from "@/components/inventory/credit-debit-gst"
import type { NoteEntry } from "@/components/inventory/credit-debit-gst"
import { notify } from "@/components/ui/notify"

interface InventoryPosModuleProps {
	activeTab: "purchase" | "sales" | "inventory" | "stock-movement" | "credit-notes" | "debit-notes" | "gst-report"
	onRecordsCountChange?: (count: number) => void
	onPartiesChange?: (parties: string[]) => void
	searchTerm?: string
}

export function InventoryPosModule({ activeTab, onRecordsCountChange, onPartiesChange, searchTerm = "" }: InventoryPosModuleProps) {

	const [creditNotes, setCreditNotes] = useState<NoteEntry[]>([])
	const [debitNotes, setDebitNotes] = useState<NoteEntry[]>([])

	const [todayPurchasesCount, setTodayPurchasesCount] = useState<number>(0)
	const [suppliersCount, setSuppliersCount] = useState<number>(0)
	const [productsCount, setProductsCount] = useState<number>(0)
	const [todayTotalAmount, setTodayTotalAmount] = useState<number>(0)

	const [loadingCounts, setLoadingCounts] = useState<boolean>(false)
	const [todaySalesCount, setTodaySalesCount] = useState<number>(0)
	const [totalCustomersCount, setTotalCustomersCount] = useState<number>(0)
	const [returnsCount, setReturnsCount] = useState<number>(0)
	const [todayRevenue, setTodayRevenue] = useState<number>(0)
	const [notesLoading, setNotesLoading] = useState<boolean>(false)

	const normalizeNote = (row: any): NoteEntry => ({
		id: row.id || `${row.noteType || 'note'}-${Date.now()}`,
		noteNumber: row.noteNumber || '',
		date: row.date || (row.noteDate ? String(row.noteDate).slice(0, 10) : ''),
		party: row.party || '',
		reference: row.reference || '',
		amount: Number(row.amount || 0),
		taxRate: Number(row.taxRate || 0),
		reason: row.reason || '',
		gstin: row.gstin || '',
	})

	const fetchNotes = async () => {
		setNotesLoading(true)
		try {
			const [creditRes, debitRes] = await Promise.all([
				fetch('/api/notes?noteType=Credit'),
				fetch('/api/notes?noteType=Debit'),
			])

			const creditJson = await creditRes.json().catch(() => [])
			const debitJson = await debitRes.json().catch(() => [])

			if (!creditRes.ok) throw new Error(creditJson?.error || 'Failed to load credit notes')
			if (!debitRes.ok) throw new Error(debitJson?.error || 'Failed to load debit notes')

			setCreditNotes(Array.isArray(creditJson) ? creditJson.map(normalizeNote) : [])
			setDebitNotes(Array.isArray(debitJson) ? debitJson.map(normalizeNote) : [])
		} catch (err) {
			console.error('Failed to fetch notes', err)
			notify.error('Failed to load notes')
		} finally {
			setNotesLoading(false)
		}
	}

	const handleAddCreditNote = async (entry: NoteEntry) => {
		const { id: _id, ...payload } = entry
		const res = await fetch('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...payload, noteType: 'Credit' }),
		})
		const data = await res.json()
		if (!res.ok) {
			throw new Error(data?.error || 'Failed to save credit note')
		}
		setCreditNotes((prev) => [normalizeNote(data), ...prev])
		notify.success('Credit note saved')
	}

	const handleAddDebitNote = async (entry: NoteEntry) => {
		const { id: _id, ...payload } = entry
		const res = await fetch('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...payload, noteType: 'Debit' }),
		})
		const data = await res.json()
		if (!res.ok) {
			throw new Error(data?.error || 'Failed to save debit note')
		}
		setDebitNotes((prev) => [normalizeNote(data), ...prev])
		notify.success('Debit note saved')
	}

	// fetch dashboard counts (purchases, suppliers, products, sales, customers)
	async function fetchCounts() {
		setLoadingCounts(true)
		try {
			const [pRes, sRes, prRes, saRes, cRes] = await Promise.all([
				fetch('/api/purchases'),
				fetch('/api/suppliers'),
				fetch('/api/products'),
				fetch('/api/sales'),
				fetch('/api/customers'),
			])

			const [pRows, sRows, prRows, saRows, cRows] = await Promise.all([
				pRes.json(), sRes.json(), prRes.json(), saRes.json(), cRes.json()
			])

			const today = new Date().toISOString().slice(0, 10)

			// purchases: count purchases with purchaseDate === today
			const todaysPurchases = Array.isArray(pRows) ? pRows.filter((r: any) => {
				const d = r.purchaseDate ? String(r.purchaseDate).slice(0, 10) : ''
				return d === today
			}) : []
			setTodayPurchasesCount(todaysPurchases.length)

			// total amount for today's purchases (sum of purchaseDetails.totalAmount)
			const totalPurchaseAmount = todaysPurchases.reduce((acc: number, row: any) => {
				if (Array.isArray(row.purchaseDetails)) {
					return acc + row.purchaseDetails.reduce((s: number, d: any) => s + Number(d.totalAmount || 0), 0)
				}
				return acc
			}, 0)
			setTodayTotalAmount(totalPurchaseAmount)

			setSuppliersCount(Array.isArray(sRows) ? sRows.length : 0)
			setProductsCount(Array.isArray(prRows) ? prRows.length : 0)

			// sales / customers
			const todaysSales = Array.isArray(saRows) ? saRows.filter((r: any) => {
				const d = r.billDate ? String(r.billDate).slice(0, 10) : ''
				return d === today
			}) : []
			setTodaySalesCount(todaysSales.length)

			const revenue = todaysSales.reduce((acc: number, row: any) => {
				if (Array.isArray(row.saleDetails)) {
					return acc + row.saleDetails.reduce((s: number, d: any) => s + Number(d.totalAmount || 0), 0)
				}
				return acc
			}, 0)
			setTodayRevenue(revenue)

			// returns: try to sum returnQnty if present in saleDetails (route may not include it)
			const returns = todaysSales.reduce((acc: number, row: any) => {
				if (Array.isArray(row.saleDetails)) {
					return acc + row.saleDetails.reduce((s: number, d: any) => s + Number(d.returnQnty || 0), 0)
				}
				return acc
			}, 0)
			setReturnsCount(returns)

			setTotalCustomersCount(Array.isArray(cRows) ? cRows.length : 0)

			// Debugging hints when APIs return empty arrays
			if (Array.isArray(pRows) && pRows.length === 0) console.warn('[DASHBOARD] /api/purchases returned empty array')
			if (Array.isArray(sRows) && sRows.length === 0) console.warn('[DASHBOARD] /api/suppliers returned empty array')
			if (Array.isArray(prRows) && prRows.length === 0) console.warn('[DASHBOARD] /api/products returned empty array')
			if (Array.isArray(saRows) && saRows.length === 0) console.warn('[DASHBOARD] /api/sales returned empty array')
			if (Array.isArray(cRows) && cRows.length === 0) console.warn('[DASHBOARD] /api/customers returned empty array')
		} catch (err) {
			console.warn('Failed to fetch dashboard counts', err)
		} finally {
			setLoadingCounts(false)
		}
	}

	useEffect(() => {
		fetchCounts()
		fetchNotes()
		const id = setInterval(fetchCounts, 30000)
		return () => clearInterval(id)
	}, [])

	const allParties = useMemo(() => {
		const set = new Set<string>()
		creditNotes.forEach((n) => { if (n.party?.trim()) set.add(n.party.trim()) })
		debitNotes.forEach((n) => { if (n.party?.trim()) set.add(n.party.trim()) })
		return Array.from(set).sort((a, b) => a.localeCompare(b))
	}, [creditNotes, debitNotes])

	useEffect(() => {
		onPartiesChange?.(allParties)
	}, [allParties, onPartiesChange])

	useEffect(() => {
		const count =
			activeTab === "purchase"
				? todayPurchasesCount
				: activeTab === "sales"
					? todaySalesCount
					: activeTab === "inventory"
						? productsCount
						: activeTab === "credit-notes"
							? creditNotes.length
							: activeTab === "debit-notes"
								? debitNotes.length
								: activeTab === "gst-report"
									? creditNotes.length + debitNotes.length
									: 0
		onRecordsCountChange?.(count)
	}, [
		activeTab,
		creditNotes.length,
		debitNotes.length,
		onRecordsCountChange,
		productsCount,
		todayPurchasesCount,
		todaySalesCount,
	])

	return (
		<div className="global-subform-table-content flex min-h-0 flex-col">
			<Tabs value={activeTab} className="space-y-0 min-h-0 flex-1 flex flex-col">
				<TabsContent value="purchase" className="space-y-4">
					<PurchaseEntryForm />
				</TabsContent>

				<TabsContent value="sales" className="space-y-4">
					<POSSalesForm />
				</TabsContent>

				<TabsContent value="inventory" className="space-y-4">
					<InventoryReportComponent />
				</TabsContent>

				<TabsContent value="stock-movement" className="space-y-4">
					<InventoryMovementForm />
				</TabsContent>

				<TabsContent value="credit-notes" className="space-y-4">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<CreditNoteTab entries={creditNotes} onAdd={handleAddCreditNote} searchTerm={searchTerm} />
				</TabsContent>

				<TabsContent value="debit-notes" className="space-y-4">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<DebitNoteTab entries={debitNotes} onAdd={handleAddDebitNote} searchTerm={searchTerm} />
				</TabsContent>

				<TabsContent value="gst-report" className="mt-0 space-y-4 min-h-0 flex-1 flex flex-col">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<GstReportTab creditNotes={creditNotes} debitNotes={debitNotes} />
				</TabsContent>
			</Tabs>
		</div>
	)
}
