import { useState } from "react"

export type MakeEmpty<T> = () => T

export default function useContinuousRows<T extends { id: string }>(makeEmpty: MakeEmpty<T>, initial?: T[], options?: { autoAppend?: boolean }) {
  const [rows, setRows] = useState<T[]>(() => {
    // If autoAppend is explicitly false, don't create an empty row on init
    if (options?.autoAppend === false) {
      return initial || []
    }
    // Default behavior: create one empty row if initial is empty
    return (initial && initial.length) ? initial : [makeEmpty()]
  })

  function addRow() {
    const newRow = makeEmpty()
    setRows(rs => [...rs, newRow])
    return newRow.id
  }

  function insertRowAfter(afterId: string) {
    const newRow = makeEmpty()
    setRows(rs => {
      const idx = rs.findIndex(r => r.id === afterId)
      if (idx === -1) return [...rs, newRow]
      const copy = [...rs]
      copy.splice(idx + 1, 0, newRow)
      return copy
    })
    return newRow.id
  }

  function ensureRowBelowInArray(arr: T[], rowId: string) {
    const idx = arr.findIndex(r => r.id === rowId)
    if (idx === -1) return arr
    const next = arr[idx + 1]
    // Only auto-insert a new empty row when the edited row is the last row in the array.
    // This prevents inserting blank rows between already-filled rows when editing earlier rows.
    if (!next) {
      const newRow = makeEmpty()
      const copy = [...arr]
      copy.splice(idx + 1, 0, newRow)
      return copy
    }

    // If there is a 'next' row but the edited row is the last one (shouldn't happen because
    // next exists only when idx < arr.length - 1), do nothing. Only append when editing the last row.
    if (idx === arr.length - 1) {
      const newRow = makeEmpty()
      const copy = [...arr]
      copy.splice(idx + 1, 0, newRow)
      return copy
    }

    return arr
  }

  function removeRow(id: string) {
    setRows(rs => rs.filter(r => r.id !== id))
  }

  function updateRow(id: string, patch: Partial<T>) {
    setRows(rs => {
      const newRows = rs.map(r => r.id === id ? { ...r, ...patch } : r)
      // Treat any change to fields other than `id` as meaningful for adding a new row.
      // This ensures subforms with different field names (service description, technicians, returns)
      // will append a new empty row when the user types into the last row.
      const hasMeaningful = Object.keys(patch).some(k => k !== 'id')
      if (hasMeaningful && options?.autoAppend !== false) {
        return ensureRowBelowInArray(newRows, id)
      }
      return newRows
    })
  }

  return { rows, addRow, insertRowAfter, removeRow, updateRow, setRows }
}
