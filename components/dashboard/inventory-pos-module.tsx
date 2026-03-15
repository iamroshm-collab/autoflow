"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import PurchaseEntryForm from "@/components/inventory/purchase-entry-form"
import { POSSalesForm } from "@/components/inventory/pos-sales"
import { InventoryReportComponent } from "@/components/inventory/inventory-report"
import { CreditNoteTab, DebitNoteTab, GstReportTab } from "@/components/inventory/credit-debit-gst"
import type { NoteEntry } from "@/components/inventory/credit-debit-gst"
import { notify } from "@/components/ui/notify"

interface InventoryPosModuleProps {
	activeTab: "purchase" | "sales" | "inventory" | "credit-notes" | "debit-notes" | "gst-report"
}

export function InventoryPosModule({ activeTab }: InventoryPosModuleProps) {

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

	return (
		<div className="space-y-6">
			<Tabs value={activeTab} className="space-y-0">
				<TabsContent value="purchase" className="global-tabs-panel space-y-4">
					<div className="grid gap-4 md:grid-cols-4">
						<Card className="bg-blue-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Today&apos;s Purchases</div>
								<div className="mt-2 text-2xl font-bold text-blue-600">{todayPurchasesCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-green-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Total Suppliers</div>
								<div className="mt-2 text-2xl font-bold text-green-600">{suppliersCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-purple-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Products Added</div>
								<div className="mt-2 text-2xl font-bold text-purple-600">{productsCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-orange-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Total Amount</div>
								<div className="mt-2 text-2xl font-bold text-orange-600">₹{todayTotalAmount.toFixed(2)}</div>
							</CardContent>
						</Card>
					</div>
					<PurchaseEntryForm />
				</TabsContent>

				<TabsContent value="sales" className="global-tabs-panel space-y-4">
					<div className="grid gap-4 md:grid-cols-4">
						<Card className="bg-blue-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Today&apos;s Sales</div>
								<div className="mt-2 text-2xl font-bold text-blue-600">{todaySalesCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-green-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Total Customers</div>
								<div className="mt-2 text-2xl font-bold text-green-600">{totalCustomersCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-red-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Returns</div>
								<div className="mt-2 text-2xl font-bold text-red-600">{returnsCount}</div>
							</CardContent>
						</Card>
						<Card className="bg-orange-50">
							<CardContent className="pt-6">
								<div className="text-sm font-medium text-gray-600">Total Revenue</div>
								<div className="mt-2 text-2xl font-bold text-orange-600">₹{todayRevenue.toFixed(2)}</div>
							</CardContent>
						</Card>
					</div>
					<POSSalesForm />
				</TabsContent>

				<TabsContent value="inventory" className="global-tabs-panel space-y-4">
					<InventoryReportComponent />
				</TabsContent>

				<TabsContent value="credit-notes" className="global-tabs-panel space-y-4">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<CreditNoteTab entries={creditNotes} onAdd={handleAddCreditNote} />
				</TabsContent>

				<TabsContent value="debit-notes" className="global-tabs-panel space-y-4">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<DebitNoteTab entries={debitNotes} onAdd={handleAddDebitNote} />
				</TabsContent>

				<TabsContent value="gst-report" className="global-tabs-panel space-y-4">
					{notesLoading && <div className="text-sm text-muted-foreground">Loading notes...</div>}
					<GstReportTab creditNotes={creditNotes} debitNotes={debitNotes} />
				</TabsContent>
			</Tabs>
		</div>
	)
}
