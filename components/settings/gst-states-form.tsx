"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { notify } from "@/components/ui/notify"
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { parseJsonResponse } from "@/lib/http"
import { Plus, Trash2, Pencil, Save, X } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface GSTState {
  stateId: string
  stateName: string
  stateCode: string
}

const emptyState: Omit<GSTState, "stateId"> = {
  stateName: "",
  stateCode: "",
}

export default function GSTStatesForm() {
  const [states, setStates] = useState<GSTState[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<GSTState, "stateId">>(emptyState)
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState<Omit<GSTState, "stateId">>(emptyState)

  useEffect(() => {
    loadStates()
  }, [])

  const loadStates = async () => {
    try {
      setIsFetching(true)
      const response = await fetch("/api/settings/states")
      const data = await parseJsonResponse<GSTState[]>(response, "Failed to load states")

      setStates(data)
    } catch (error) {
      console.error("Error loading states:", error)
      errorAction(error instanceof Error ? error.message : "Failed to load states")
    } finally {
      setIsFetching(false)
    }
  }

  const handleAdd = async () => {
    if (!addForm.stateName.trim()) {
      errorAction("State name is required")
      return
    }

    if (!addForm.stateCode.trim()) {
      errorAction("State code is required")
      return
    }

    try {
      setIsLoading(true)
      startAction("Adding GST state...")

      const response = await fetch("/api/settings/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      })

      await parseJsonResponse<GSTState>(response, "Failed to add state")

      successAction("State added successfully")
      setAddForm(emptyState)
      setIsAdding(false)
      await loadStates()
    } catch (error) {
      console.error("Error adding state:", error)
      errorAction(error instanceof Error ? error.message : "Failed to add state")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (stateId: string) => {
    if (!editForm.stateName.trim()) {
      errorAction("State name is required")
      return
    }

    if (!editForm.stateCode.trim()) {
      errorAction("State code is required")
      return
    }

    try {
      setIsLoading(true)
      startAction("Updating GST state...")

      const response = await fetch("/api/settings/states", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId, ...editForm }),
      })

      await parseJsonResponse<GSTState>(response, "Failed to update state")

      successAction("State updated successfully")
      setEditingId(null)
      setEditForm(emptyState)
      await loadStates()
    } catch (error) {
      console.error("Error updating state:", error)
      errorAction(error instanceof Error ? error.message : "Failed to update state")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (stateId: string) => {
    if (!confirm("Are you sure you want to delete this state?")) {
      return
    }

    try {
      setIsLoading(true)
      startAction("Deleting state...")

      const response = await fetch(`/api/settings/states?stateId=${stateId}`, {
        method: "DELETE",
      })

      await parseJsonResponse<{ success: boolean }>(response, "Failed to delete state")

      successAction("State deleted successfully")
      await loadStates()
    } catch (error) {
      console.error("Error deleting state:", error)
      errorAction(error instanceof Error ? error.message : "Failed to delete state")
    } finally {
      setIsLoading(false)
    }
  }

  const startEdit = (state: GSTState) => {
    setEditingId(state.stateId)
    setEditForm({
      stateName: state.stateName,
      stateCode: state.stateCode,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyState)
  }

  const cancelAdd = () => {
    setIsAdding(false)
    setAddForm(emptyState)
  }

  if (isFetching) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading states...</div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">States</h3>
        </div>

        <Dialog open={isAdding} onOpenChange={(open) => { 
          setIsAdding(open)
          if (!open) {
            setAddForm(emptyState)
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-visible">
            <DialogHeader>
              <DialogTitle>Add New State</DialogTitle>
              <DialogDescription>Enter the state details to create a new state record.</DialogDescription>
            </DialogHeader>

            <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4 overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2">
                <Label htmlFor="add-stateName">State Name *</Label>
                <Input
                  id="add-stateName"
                  name="stateName"
                  value={addForm.stateName}
                  onChange={(e) => setAddForm({ ...addForm, stateName: e.target.value })}
                  disabled={isLoading}
                  placeholder="Enter state name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-stateCode">State Code *</Label>
                <Input
                  id="add-stateCode"
                  value={addForm.stateCode}
                  onChange={(e) => setAddForm({ ...addForm, stateCode: e.target.value })}
                  disabled={isLoading}
                  placeholder="Enter state code"
                />
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">State Name</th>
                <th className="text-left p-3 font-medium">State Code</th>
                <th className="text-center p-3 font-medium w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {states.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-6 text-muted-foreground">
                    No states found. Click "Add State" to create one.
                  </td>
                </tr>
              ) : (
                states.map((state) => (
                  <tr key={state.stateId} className="border-t">
                    {editingId === state.stateId ? (
                      <>
                        <td className="p-2">
                          <Input
                            name="stateName"
                            value={editForm.stateName}
                            onChange={(e) => setEditForm({ ...editForm, stateName: e.target.value })}
                            disabled={isLoading}
                            className="h-9"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            name="stateCode"
                            value={editForm.stateCode}
                            onChange={(e) => setEditForm({ ...editForm, stateCode: e.target.value })}
                            disabled={isLoading}
                            className="h-9"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              onClick={() => handleUpdate(state.stateId)}
                              disabled={isLoading}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={cancelEdit}
                              disabled={isLoading}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">{state.stateName}</td>
                        <td className="p-3">{state.stateCode}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => startEdit(state)}
                                  disabled={isLoading || editingId !== null}
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-600 hover:text-blue-800"
                                  aria-label={`Edit ${state.stateName}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center">Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleDelete(state.stateId)}
                                  disabled={isLoading || editingId !== null}
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-800"
                                  aria-label={`Delete ${state.stateName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center">Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add State Button - Sticky footer */}
        <div className="sticky-form-actions flex justify-center mt-4">
          {!isAdding && (
            <Button
              onClick={() => setIsAdding(true)}
              className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent px-3 py-2 rounded-md text-sm"
              variant="ghost"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add State
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
