"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { notify } from "@/components/ui/notify"
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { parseJsonResponse } from "@/lib/http"
import { getMobileValidationMessage, normalizeMobileNumber } from "@/lib/mobile-validation"
import { Plus, Trash2, Save, X, Pencil } from "lucide-react"
// Use the same Pencil icon as supplier actions for consistency
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface SparePartShop {
  id: string
  shopName: string
  address: string
  mobile: string
  pan: string
  gstin: string
  stateId: string
  state?: State | null
}

interface State {
  id: string
  stateName: string
  stateCode: string
}

interface ApiState {
  id?: string
  stateId?: string
  stateName: string
  stateCode?: string | null
}

const emptyShop: Omit<SparePartShop, "id"> = {
  shopName: "",
  address: "",
  mobile: "",
  pan: "",
  gstin: "",
  stateId: "",
}

export default function SparePartShopsForm() {
  const [shops, setShops] = useState<SparePartShop[]>([])
  const [states, setStates] = useState<State[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState<Omit<SparePartShop, "id">>(emptyShop)
  const [addStateFilter, setAddStateFilter] = useState("")
  const [showAddStateDropdown, setShowAddStateDropdown] = useState(false)
  const [addStateSelectedIndex, setAddStateSelectedIndex] = useState(-1)
  const [isEditingModal, setIsEditingModal] = useState(false)
  const [editingShopId, setEditingShopId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<SparePartShop, "id">>(emptyShop)
  const [editStateFilter, setEditStateFilter] = useState("")
  const [showEditStateDropdown, setShowEditStateDropdown] = useState(false)
  const [editStateSelectedIndex, setEditStateSelectedIndex] = useState(-1)

  // Refs for state dropdowns
  const addStateListRef = useRef<HTMLDivElement | null>(null)
  const addStateOptionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const editStateListRef = useRef<HTMLDivElement | null>(null)
  const editStateOptionRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    loadShops()
    loadStates()
  }, [])

  // Scroll selected item into view for add dropdown
  useEffect(() => {
    if (addStateSelectedIndex >= 0 && addStateOptionRefs.current[addStateSelectedIndex]) {
      addStateOptionRefs.current[addStateSelectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [addStateSelectedIndex])

  // Scroll selected item into view for edit dropdown
  useEffect(() => {
    if (editStateSelectedIndex >= 0 && editStateOptionRefs.current[editStateSelectedIndex]) {
      editStateOptionRefs.current[editStateSelectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [editStateSelectedIndex])

  // Close add state dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAddStateDropdown && addStateListRef.current && !addStateListRef.current.contains(event.target as Node)) {
        const inputElement = document.getElementById('add-state')
        if (inputElement && !inputElement.contains(event.target as Node)) {
          setShowAddStateDropdown(false)
          setAddStateSelectedIndex(-1)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddStateDropdown])

  // Close edit state dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEditStateDropdown && editStateListRef.current && !editStateListRef.current.contains(event.target as Node)) {
        const inputElement = document.getElementById('edit-state')
        if (inputElement && !inputElement.contains(event.target as Node)) {
          setShowEditStateDropdown(false)
          setEditStateSelectedIndex(-1)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEditStateDropdown])

  const loadShops = async () => {
    try {
      setIsFetching(true)
      const response = await fetch("/api/settings/spare-part-shops")
      const data = await parseJsonResponse<SparePartShop[]>(response, "Failed to load spare part shops")

      setShops(data)
    } catch (error) {
      console.error("Error loading spare part shops:", error)
      errorAction(error instanceof Error ? error.message : "Failed to load spare part shops")
    } finally {
      setIsFetching(false)
    }
  }

  const loadStates = async () => {
    try {
      const response = await fetch("/api/settings/states")
      const data = await parseJsonResponse<ApiState[]>(response, "Failed to load states")
      
      const formattedStates = data.map((s) => ({
        id: String(s.stateId || s.id || ""),
        stateName: String(s.stateName || ""),
        stateCode: String(s.stateCode || ""),
      }))
      
      setStates(formattedStates)
    } catch (error) {
      console.error("Error loading states:", error)
    }
  }

  const getStateName = (stateId: string) => {
    if (!stateId) return ""
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? state.stateName : ""
  }

  const getStateDisplay = (stateId: string) => {
    if (!stateId) return ""
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? `${state.stateName} (${state.stateCode})` : ""
  }

  const getStateNumericId = (stateId: string) => {
    if (!stateId) return ""
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? state.id : ""
  }

  const getStateCode = (stateId: string) => {
    if (!stateId) return ""
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? state.stateCode : ""
  }

  const getStateIdByName = (stateName: string) => {
    if (!stateName) return ""
    const state = states.find(s => s.stateName.toLowerCase() === stateName.toLowerCase())
    return state ? state.id : ""
  }

  const handleAdd = async () => {
    if (!addForm.shopName.trim()) {
      errorAction("Shop name is required")
      return
    }

    const mobileError = getMobileValidationMessage(addForm.mobile)
    if (mobileError) {
      errorAction(mobileError)
      return
    }

    try {
      setIsLoading(true)
      startAction("Adding spare part shop...")

      const response = await fetch("/api/settings/spare-part-shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, mobile: normalizeMobileNumber(addForm.mobile) }),
      })

      await parseJsonResponse<SparePartShop>(response, "Failed to add shop")

      successAction("Spare part shop added successfully")
      setAddForm(emptyShop)
      setIsAdding(false)
      await loadShops()
    } catch (error) {
      console.error("Error adding shop:", error)
      errorAction(error instanceof Error ? error.message : "Failed to add shop")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editForm.shopName.trim()) {
      errorAction("Shop name is required")
      return
    }

    const mobileError = getMobileValidationMessage(editForm.mobile)
    if (mobileError) {
      errorAction(mobileError)
      return
    }

    if (!editingShopId) return

    try {
      setIsLoading(true)
      startAction("Updating spare part shop...")

      const response = await fetch("/api/settings/spare-part-shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingShopId, ...editForm, mobile: normalizeMobileNumber(editForm.mobile) }),
      })

      await parseJsonResponse<SparePartShop>(response, "Failed to update shop")

      successAction("Spare part shop updated successfully")
      setEditingShopId(null)
      setEditForm(emptyShop)
      setEditStateFilter("")
      setShowEditStateDropdown(false)
      setIsEditingModal(false)
      await loadShops()
    } catch (error) {
      console.error("Error updating shop:", error)
      errorAction(error instanceof Error ? error.message : "Failed to update shop")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this spare part shop?")) {
      return
    }

    try {
      setIsLoading(true)
      startAction("Deleting spare part shop...")

      const response = await fetch(`/api/settings/spare-part-shops?id=${id}`, {
        method: "DELETE",
      })

      await parseJsonResponse<{ success: boolean }>(response, "Failed to delete shop")

      successAction("Spare part shop deleted successfully")
      await loadShops()
    } catch (error) {
      console.error("Error deleting shop:", error)
      errorAction(error instanceof Error ? error.message : "Failed to delete shop")
    } finally {
      setIsLoading(false)
    }
  }

  const startEdit = (shop: SparePartShop) => {
    setEditingShopId(shop.id)
    setEditForm({
      shopName: shop.shopName,
      address: shop.address || "",
      mobile: shop.mobile || "",
      pan: shop.pan || "",
      gstin: shop.gstin || "",
      stateId: shop.stateId || "",
    })
    setEditStateFilter(getStateName(shop.stateId || ""))
    setShowEditStateDropdown(false)
    setIsEditingModal(true)
  }

  const cancelEdit = () => {
    setEditingShopId(null)
    setEditForm(emptyShop)
    setEditStateFilter("")
    setShowEditStateDropdown(false)
    setIsEditingModal(false)
  }

  const cancelAdd = () => {
    setIsAdding(false)
    setAddForm(emptyShop)
    setAddStateFilter("")
    setShowAddStateDropdown(false)
  }

  if (isFetching) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading spare part shops...</div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Spare Part Shops</h3>
        </div>

        <Dialog open={isAdding} onOpenChange={(open) => { 
          setIsAdding(open)
          if (!open) {
            setAddForm(emptyShop)
            setAddStateFilter("")
            setShowAddStateDropdown(false)
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-visible flex flex-col">
            <DialogHeader>
              <DialogTitle>Add New Shop</DialogTitle>
              <DialogDescription>Enter the spare part shop details to create a new shop record.</DialogDescription>
            </DialogHeader>

            <div className="overflow-visible flex-1">
              <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2">
                <Label htmlFor="add-shopName">Shop Name *</Label>
                <Input
                  id="add-shopName"
                  name="shopName"
                  value={addForm.shopName}
                  onChange={(e) => setAddForm({ ...addForm, shopName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-mobile">Mobile</Label>
                <Input
                  id="add-mobile"
                  value={addForm.mobile}
                  onChange={(e) => setAddForm({ ...addForm, mobile: normalizeMobileNumber(e.target.value) })}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="add-state">State Name</Label>
                <div className="relative w-full">
                  <Input
                    id="add-state"
                    placeholder="Search and select state..."
                    value={addStateFilter}
                    onChange={(e) => {
                      setAddStateFilter(e.target.value)
                      setShowAddStateDropdown(true)
                      setAddStateSelectedIndex(-1)
                    }}
                    onKeyDown={(e) => {
                      if (!showAddStateDropdown) return

                      const filteredStates = states.filter(state =>
                        state.id && (
                          addStateFilter === "" ||
                          state.stateName.toLowerCase().includes(addStateFilter.toLowerCase()) ||
                          state.stateCode.toLowerCase().includes(addStateFilter.toLowerCase())
                        )
                      )

                      switch (e.key) {
                        case "ArrowDown":
                          e.preventDefault()
                          setAddStateSelectedIndex(prev =>
                            prev < filteredStates.length - 1 ? prev + 1 : prev
                          )
                          break
                        case "ArrowUp":
                          e.preventDefault()
                          setAddStateSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
                          break
                        case "Enter":
                          e.preventDefault()
                          if (addStateSelectedIndex >= 0 && filteredStates[addStateSelectedIndex]) {
                            const state = filteredStates[addStateSelectedIndex]
                            setAddForm({ ...addForm, stateId: state.id })
                            setAddStateFilter(state.stateName)
                            setShowAddStateDropdown(false)
                            setAddStateSelectedIndex(-1)
                          }
                          break
                        case "Escape":
                          e.preventDefault()
                          setShowAddStateDropdown(false)
                          setAddStateSelectedIndex(-1)
                          break
                      }
                    }}
                    onClick={() => {
                      setShowAddStateDropdown((prev) => {
                        if (prev) {
                          setAddStateSelectedIndex(-1)
                        }
                        return !prev
                      })
                    }}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                  {showAddStateDropdown && (
                    <div
                      ref={addStateListRef}
                      className="absolute top-full left-0 right-0 mt-1 dropdown-scroll z-[300]"
                      onWheel={(e) => {
                        const el = addStateListRef.current
                        if (!el) return
                        el.scrollTop += e.deltaY
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      {states.length > 0 ? (
                        <>
                          {states
                            .filter(state =>
                              state.id && (
                                addStateFilter === "" ||
                                state.stateName.toLowerCase().includes(addStateFilter.toLowerCase()) ||
                                state.stateCode.toLowerCase().includes(addStateFilter.toLowerCase())
                              )
                            )
                            .map((state, index) => (
                              <button
                                key={state.id}
                                ref={(el) => {
                                  addStateOptionRefs.current[index] = el
                                }}
                                onClick={() => {
                                  setAddForm({ ...addForm, stateId: state.id })
                                  setAddStateFilter(state.stateName)
                                  setShowAddStateDropdown(false)
                                  setAddStateSelectedIndex(-1)
                                }}
                                className={`dropdown-item ${
                                  index === addStateSelectedIndex ? "selected" : ""
                                }`}
                              >
                                {state.stateName}
                              </button>
                            ))}
                          {states.filter(state =>
                            addStateFilter === "" || (
                              state.stateName.toLowerCase().includes(addStateFilter.toLowerCase()) ||
                              state.stateCode.toLowerCase().includes(addStateFilter.toLowerCase())
                            )
                          ).length === 0 && (
                            <div className="dropdown-empty-state">No states found</div>
                          )}
                        </>
                      ) : (
                        <div className="dropdown-empty-state">Loading states...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-stateId">State Code</Label>
                <Input
                  id="add-stateId"
                  value={getStateCode(addForm.stateId)}
                  disabled
                  className="bg-slate-50 text-slate-600"
                  placeholder="Automatically populated"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="add-address">Address</Label>
                <Input
                  id="add-address"
                  name="address"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-pan">PAN</Label>
                <Input
                  id="add-pan"
                  value={addForm.pan}
                  onChange={(e) => setAddForm({ ...addForm, pan: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-gstin">GSTIN</Label>
                <Input
                  id="add-gstin"
                  value={addForm.gstin}
                  onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
            </div>

            <DialogFooter className="flex gap-4 justify-end mt-4">
              <Button onClick={cancelAdd} disabled={isLoading} variant="outline" className="bg-white hover:bg-gray-100">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditingModal} onOpenChange={(open) => {
          if (!open) cancelEdit()
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-visible flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Shop</DialogTitle>
              <DialogDescription>Update the spare part shop details.</DialogDescription>
            </DialogHeader>

            <div className="overflow-visible flex-1">
              <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2">
                <Label htmlFor="edit-shopName">Shop Name *</Label>
                <Input
                  id="edit-shopName"
                  name="shopName"
                  value={editForm.shopName}
                  onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mobile">Mobile</Label>
                <Input
                  id="edit-mobile"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: normalizeMobileNumber(e.target.value) })}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="edit-state">State Name</Label>
                <div className="relative w-full">
                  <Input
                    id="edit-state"
                    placeholder="Search and select state..."
                    value={editStateFilter}
                    onChange={(e) => {
                      setEditStateFilter(e.target.value)
                      setShowEditStateDropdown(true)
                      setEditStateSelectedIndex(-1)
                    }}
                    onKeyDown={(e) => {
                      if (!showEditStateDropdown) return

                      const filteredStates = states.filter(state =>
                        state.id && (
                          editStateFilter === "" ||
                          state.stateName.toLowerCase().includes(editStateFilter.toLowerCase()) ||
                          state.stateCode.toLowerCase().includes(editStateFilter.toLowerCase())
                        )
                      )

                      switch (e.key) {
                        case "ArrowDown":
                          e.preventDefault()
                          setEditStateSelectedIndex(prev =>
                            prev < filteredStates.length - 1 ? prev + 1 : prev
                          )
                          break
                        case "ArrowUp":
                          e.preventDefault()
                          setEditStateSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
                          break
                        case "Enter":
                          e.preventDefault()
                          if (editStateSelectedIndex >= 0 && filteredStates[editStateSelectedIndex]) {
                            const state = filteredStates[editStateSelectedIndex]
                            setEditForm({ ...editForm, stateId: state.id })
                            setEditStateFilter(state.stateName)
                            setShowEditStateDropdown(false)
                            setEditStateSelectedIndex(-1)
                          }
                          break
                        case "Escape":
                          e.preventDefault()
                          setShowEditStateDropdown(false)
                          setEditStateSelectedIndex(-1)
                          break
                      }
                    }}
                    onClick={() => {
                      setShowEditStateDropdown((prev) => {
                        if (prev) {
                          setEditStateSelectedIndex(-1)
                        }
                        return !prev
                      })
                    }}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                  {showEditStateDropdown && (
                    <div
                      ref={editStateListRef}
                      className="absolute top-full left-0 right-0 mt-1 dropdown-scroll z-[300]"
                      onWheel={(e) => {
                        const el = editStateListRef.current
                        if (!el) return
                        el.scrollTop += e.deltaY
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      {states.length > 0 ? (
                        <>
                          {states
                            .filter(state =>
                              state.id && (
                                editStateFilter === "" ||
                                state.stateName.toLowerCase().includes(editStateFilter.toLowerCase()) ||
                                state.stateCode.toLowerCase().includes(editStateFilter.toLowerCase())
                              )
                            )
                            .map((state, index) => (
                              <button
                                key={state.id}
                                ref={(el) => {
                                  editStateOptionRefs.current[index] = el
                                }}
                                onClick={() => {
                                  setEditForm({ ...editForm, stateId: state.id })
                                  setEditStateFilter(state.stateName)
                                  setShowEditStateDropdown(false)
                                  setEditStateSelectedIndex(-1)
                                }}
                                className={`dropdown-item ${
                                  index === editStateSelectedIndex ? "selected" : ""
                                }`}
                              >
                                {state.stateName}
                              </button>
                            ))}
                          {states.filter(state =>
                            editStateFilter === "" || (
                              state.stateName.toLowerCase().includes(editStateFilter.toLowerCase()) ||
                              state.stateCode.toLowerCase().includes(editStateFilter.toLowerCase())
                            )
                          ).length === 0 && (
                            <div className="dropdown-empty-state">No states found</div>
                          )}
                        </>
                      ) : (
                        <div className="dropdown-empty-state">Loading states...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stateId">State Code</Label>
                <Input
                  id="edit-stateId"
                  value={getStateCode(editForm.stateId)}
                  disabled
                  className="bg-slate-50 text-slate-600"
                  placeholder="Automatically populated"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  name="address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pan">PAN</Label>
                <Input
                  id="edit-pan"
                  value={editForm.pan}
                  onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gstin">GSTIN</Label>
                <Input
                  id="edit-gstin"
                  value={editForm.gstin}
                  onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
            </div>

            <DialogFooter className="flex gap-4 justify-end mt-4">
              <Button onClick={cancelEdit} disabled={isLoading} variant="outline" className="bg-white hover:bg-gray-100">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={isLoading} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-3">
          {shops.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">No spare part shops found. Click "Add Shop" to create one.</div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="border-b bg-muted/30">
                  <div className="flex items-center justify-between py-3 px-2">
                    <div className="flex-1 flex gap-4">
                      <div className="min-w-[220px] text-center">
                        <Label className="text-sm font-semibold">Shop Name</Label>
                      </div>
                      <div className="min-w-[140px] text-center">
                        <Label className="text-sm font-semibold">Mobile</Label>
                      </div>
                      <div className="min-w-[160px] text-center">
                        <Label className="text-sm font-semibold">State Name</Label>
                      </div>
                      <div className="min-w-[100px] text-center">
                        <Label className="text-sm font-semibold">PAN</Label>
                      </div>
                      <div className="min-w-[120px] text-center">
                        <Label className="text-sm font-semibold">GSTIN</Label>
                      </div>
                      <div className="min-w-[200px] text-center">
                        <Label className="text-sm font-semibold">Address</Label>
                      </div>
                    </div>
                    <div className="min-w-[120px] flex flex-col items-center justify-center">
                      <Label className="text-sm font-semibold">Actions</Label>
                    </div>
                  </div>
                </div>
                {shops.map((shop) => (
                <div key={shop.id} className="border-b last:border-b-0">
                  <div className="flex items-center justify-between py-3 px-2">
                    <div className="flex-1 flex gap-4 items-center">
                      <div className="min-w-[220px] text-center">
                        <div className="text-sm text-slate-700">{shop.shopName || "—"}</div>
                      </div>

                      <div className="min-w-[140px] text-center">
                        <div className="text-sm text-slate-700">{shop.mobile || "—"}</div>
                      </div>

                      <div className="min-w-[160px] text-center">
                        <div className="text-sm font-medium text-slate-700">{shop.state?.stateName || getStateDisplay(shop.stateId).name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{shop.state?.stateCode || getStateDisplay(shop.stateId).code}</div>
                      </div>

                      <div className="min-w-[100px] text-center">
                        <div className="text-sm text-slate-700">{shop.pan || "—"}</div>
                      </div>

                      <div className="min-w-[120px] text-center">
                        <div className="text-sm text-slate-700">{shop.gstin || "—"}</div>
                      </div>

                      <div className="min-w-[200px] text-center">
                        <div className="text-sm text-slate-700">{shop.address || "—"}</div>
                      </div>
                    </div>

                    <div className="min-w-[120px] flex items-center justify-center">
                      <div className="w-28 flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button onClick={() => startEdit(shop)} disabled={isLoading} variant="ghost" size="icon" className="text-blue-600 hover:text-blue-800" aria-label={`Edit ${shop.shopName}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">Edit</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button onClick={() => handleDelete(shop.id)} disabled={isLoading} variant="ghost" size="icon" className="text-red-600 hover:text-red-800" aria-label={`Delete ${shop.shopName}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              </>
          )}
        </div>

        {/* Add Shop Button - Sticky footer */}
        <div className="sticky-form-actions flex justify-center mt-4">
          {!isAdding && (
            <Button
              onClick={() => setIsAdding(true)}
              className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent px-3 py-2 rounded-md text-sm"
              variant="ghost"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shop
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
