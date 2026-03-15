"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface ConfirmNewMakeModelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  make: string
  model: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmNewMakeModelModal({
  open,
  onOpenChange,
  make,
  model,
  onConfirm,
  onCancel,
}: ConfirmNewMakeModelModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>New Vehicle Make/Model</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              The vehicle make/model you entered is not in our database:
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div>
                <strong>Make:</strong> <span className="text-foreground">{make}</span>
              </div>
              <div>
                <strong>Model:</strong> <span className="text-foreground">{model}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-900 text-sm">
              <strong>⚠️ Important:</strong> Please verify the spelling is correct. 
              Once saved, this entry cannot be edited, only deactivated by an administrator.
            </div>
            <p className="font-medium">
              Do you want to save this new make/model combination to the database?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            No, Let Me Check Again
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-green-600 hover:bg-green-700">
            Yes, Spelling is Correct - Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
