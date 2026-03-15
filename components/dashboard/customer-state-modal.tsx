"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { notify } from "@/components/ui/notify"

interface State {
  stateId: string
  stateName: string
  stateCode?: string
}

interface CustomerStateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  currentStateId?: string
  currentStateName?: string
  mandatory?: boolean
  onSave: (stateId: string, stateName: string) => void
}

export function CustomerStateModal({
  open,
  onOpenChange,
  customerName,
  currentStateId,
  currentStateName,
  onSave,
}: CustomerStateModalProps) {
  const [states, setStates] = useState<State[]>([])
  const [selectedStateId, setSelectedStateId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch("/api/settings/states")
        const data = await response.json()
        
        if (Array.isArray(data)) {
          setStates(data)
        } else if (data.states && Array.isArray(data.states)) {
          setStates(data.states)
        }
      } catch (error) {
        console.error("Error fetching states:", error)
        notify.warn("Failed to load states")
      }
    }

    if (open) {
      fetchStates()
      setSelectedStateId(currentStateId || "")
    }
  }, [open, currentStateId])

  const handleSave = () => {
    if (!selectedStateId) {
      notify.warn("Please select a state")
      return
    }

    const selected = states.find((s) => s.stateId === selectedStateId)
    if (!selected) {
      notify.warn("Invalid state selection")
      return
    }

    onSave(selected.stateCode || selected.stateId, selected.stateName)
    onOpenChange(false)
  }

  const selectedState = states.find((s) => s.stateId === selectedStateId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Add Customer State</DialogTitle>
          <DialogDescription>
            Select the state for customer: {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stateName" className="font-semibold">State Name</Label>
            <Select
              value={selectedStateId}
              onValueChange={setSelectedStateId}
              disabled={isLoading}
            >
              <SelectTrigger id="stateName" className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.stateId} value={state.stateId}>
                    {state.stateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stateId" className="font-semibold">State Code</Label>
            <Input
              id="stateId"
              value={selectedState?.stateCode || ""}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 bg-muted text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-5 justify-end pt-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
