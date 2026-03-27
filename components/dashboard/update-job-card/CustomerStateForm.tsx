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

interface CustomerStateFormProps {
  states: Array<{ stateId: string; stateName: string; stateCode?: string }>
  selectedStateId: string
  isLoading: boolean
  isLoadingStates: boolean
  onStateIdChange: (stateId: string) => void
  onSave: () => void
}

export function CustomerStateForm({
  states,
  selectedStateId,
  isLoading,
  isLoadingStates,
  onStateIdChange,
  onSave,
}: CustomerStateFormProps) {
  const selectedStateCode =
    states.find((state) => state.stateId === selectedStateId)?.stateCode || ""

  return (
    <div className="shrink-0 px-4 pb-3">
      <div className="border rounded-md p-4 bg-blue-50">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="stateName">State Name</Label>
            <Select
              value={selectedStateId}
              onValueChange={onStateIdChange}
              disabled={isLoading || isLoadingStates}
            >
              <SelectTrigger id="stateName" className="h-10">
                <SelectValue placeholder={isLoadingStates ? "Loading states..." : "Select a state"} />
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

          <div className="grid gap-2">
            <Label htmlFor="stateCode">State Code</Label>
            <Input
              id="stateCode"
              value={selectedStateCode}
              readOnly
              disabled
              className="h-10 bg-muted"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            onClick={onSave}
            disabled={isLoading || !selectedStateId || isLoadingStates}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Save State
          </Button>
        </div>
      </div>
    </div>
  )
}
