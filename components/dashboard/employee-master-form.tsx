"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from '@/components/ui/notify'
import { successAction, errorAction } from "@/lib/action-feedback"
import { getMobileValidationMessage, normalizeMobileNumber } from "@/lib/mobile-validation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDateDDMMYY } from "@/lib/utils"

interface Employee {
  employeeId: number
  empName: string
  idNumber: string
  mobile: string
  address: string | null
  designation: string | null
  salaryPerday: number
  startDate: string | null
  endDate: string | null
  attendance: string | null
  attendanceDate: string | null
  facePhotoUrl: string | null
  facePhotoUpdatedAt: string | null
  isAttendanceEligible: boolean
  isTechnician: boolean
  isArchived: boolean
}

interface EmployeeFormState {
  empName: string
  idNumber: string
  mobile: string
  address: string
  designation: string
  salaryPerday: string
  startDate: string
  endDate: string
  attendance: string
  attendanceDate: string
  facePhotoUrl: string
  isAttendanceEligible: boolean
  isTechnician: boolean
}

const defaultForm: EmployeeFormState = {
  empName: "",
  idNumber: "",
  mobile: "",
  address: "",
  designation: "",
  salaryPerday: "",
  startDate: "",
  endDate: "",
  attendance: "Present",
  attendanceDate: "",
  facePhotoUrl: "",
  isAttendanceEligible: true,
  isTechnician: false,
}

const toDateInput = (value: string | null) => {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

interface EmployeeMasterFormProps {
  searchTerm?: string
  selectedEmployeeId?: number | null
  onSelectedEmployeeHandled?: () => void
}

export function EmployeeMasterForm({
  searchTerm = "",
  selectedEmployeeId,
  onSelectedEmployeeHandled,
}: EmployeeMasterFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState(searchTerm)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [form, setForm] = useState<EmployeeFormState>(defaultForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const isAdminDesignation = form.designation.trim().toLowerCase().includes("admin")

  const loadEmployees = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const response = await fetch(`/api/employees?search=${encodeURIComponent(search)}`)
      console.debug("[EmployeeMasterForm] GET /api/employees", response.status, response.ok)
      const data = await response.json()

      if (!response.ok) {
        console.debug("[EmployeeMasterForm] GET /api/employees error payload:", data)
        throw new Error(data.error || "Failed to fetch employees")
      }

      console.debug("[EmployeeMasterForm] employees loaded:", Array.isArray(data) ? data.length : 0)
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[EmployeeMasterForm] loadEmployees error:", message)
      setFetchError(message)
      errorAction(message || "Failed to fetch employees")
      setEmployees([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [search])

  useEffect(() => {
    setSearch(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (!selectedEmployeeId) {
      return
    }

    let isCancelled = false

    const loadSelectedEmployee = async () => {
      try {
        const existingEmployee = employees.find((item) => item.employeeId === selectedEmployeeId)

        if (existingEmployee) {
          if (!isCancelled) {
            loadEmployeeIntoForm(existingEmployee)
          }
          return
        }

        const response = await fetch(`/api/employees/${selectedEmployeeId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch employee")
        }

        if (!isCancelled) {
          loadEmployeeIntoForm(data as Employee)
        }
      } catch (error) {
        if (!isCancelled) {
          errorAction(error instanceof Error ? error.message : "Failed to fetch employee")
        }
      } finally {
        if (!isCancelled) {
          onSelectedEmployeeHandled?.()
        }
      }
    }

    void loadSelectedEmployee()

    return () => {
      isCancelled = true
    }
  }, [employees, onSelectedEmployeeHandled, selectedEmployeeId])

  useEffect(() => {
    if (isAdminDesignation && form.isAttendanceEligible) {
      setForm((prev) => ({ ...prev, isAttendanceEligible: false }))
    }
  }, [form.isAttendanceEligible, isAdminDesignation])

  const loadEmployeeIntoForm = (employee: Employee) => {
    setEditingEmployeeId(employee.employeeId)
    setForm({
      empName: employee.empName || "",
      idNumber: employee.idNumber || "",
      mobile: employee.mobile || "",
      address: employee.address || "",
      designation: employee.designation || "",
      salaryPerday: String(employee.salaryPerday || 0),
      startDate: toDateInput(employee.startDate),
      endDate: toDateInput(employee.endDate),
      attendance: employee.attendance || "Present",
      attendanceDate: toDateInput(employee.attendanceDate),
      facePhotoUrl: employee.facePhotoUrl || "",
      isAttendanceEligible: employee.isAttendanceEligible !== false,
      isTechnician: Boolean(employee.isTechnician),
    })
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingEmployeeId(null)
    setForm(defaultForm)
    setIsModalOpen(true)
  }

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      setEditingEmployeeId(null)
      setForm(defaultForm)
    }
  }

  const handleSave = async () => {
    if (!form.empName.trim() || !form.idNumber.trim() || !form.mobile.trim()) {
      toast.error("EmpName, IDNumber, and Mobile are required")
      return
    }

    const mobileError = getMobileValidationMessage(form.mobile, "Employee mobile number")
    if (mobileError) {
      toast.error(mobileError)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        empName: form.empName.trim(),
        idNumber: form.idNumber.trim(),
        mobile: normalizeMobileNumber(form.mobile),
        address: form.address.trim(),
        designation: form.designation.trim(),
        salaryPerday: Number(form.salaryPerday || 0),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        attendance: form.attendance || null,
        attendanceDate: form.attendanceDate || null,
        facePhotoUrl: form.facePhotoUrl || null,
        isAttendanceEligible: form.isAttendanceEligible,
        isTechnician: form.isTechnician,
      }

      const url = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : "/api/employees"
      const method = editingEmployeeId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save employee")
      }

      successAction(editingEmployeeId ? "Employee updated" : "Employee created")
      await loadEmployees()

      if (data?.employeeId) {
        const updated = data as Employee
        setEditingEmployeeId(updated.employeeId)
        setForm({
          empName: updated.empName || "",
          idNumber: updated.idNumber || "",
          mobile: updated.mobile || "",
          address: updated.address || "",
          designation: updated.designation || "",
          salaryPerday: String(updated.salaryPerday || 0),
          startDate: toDateInput(updated.startDate),
          endDate: toDateInput(updated.endDate),
          attendance: updated.attendance || "Present",
          attendanceDate: toDateInput(updated.attendanceDate),
          facePhotoUrl: updated.facePhotoUrl || "",
          isAttendanceEligible: updated.isAttendanceEligible !== false,
          isTechnician: Boolean(updated.isTechnician),
        })
      }

      setIsModalOpen(false)
      setEditingEmployeeId(null)
      setForm(defaultForm)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save employee")
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!editingEmployeeId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/employees/${editingEmployeeId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive employee")
      }

      successAction("Employee archived safely")
      setIsModalOpen(false)
      setEditingEmployeeId(null)
      setForm(defaultForm)
      await loadEmployees()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to archive employee")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteFromList = async (employeeId: number) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive employee")
      }

      successAction("Employee archived safely")
      if (editingEmployeeId === employeeId) {
        setEditingEmployeeId(null)
        setForm(defaultForm)
        setIsModalOpen(false)
      }
      await loadEmployees()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to archive employee")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("employeeName", form.empName || "employee")

    setIsSaving(true)
    try {
      const response = await fetch("/api/uploads/employee-photo", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to upload employee photo")
      }

      setForm((prev) => ({ ...prev, facePhotoUrl: String(data.photoUrl || "") }))
      successAction("Employee photo uploaded")
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to upload employee photo")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold">Employee List</h2>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="text-center font-medium px-3 py-2">Emp Name</th>
                <th className="text-center font-medium px-3 py-2">Mobile</th>
                <th className="text-center font-medium px-3 py-2">Designation</th>
                <th className="text-center font-medium px-3 py-2">Salary/Day</th>
                <th className="text-center font-medium px-3 py-2">Start Date</th>
                <th className="text-center font-medium px-3 py-2">Attendance</th>
                <th className="text-center font-medium px-3 py-2">Photo</th>
                <th className="text-center font-medium px-3 py-2">Technician</th>
                <th className="text-center font-medium px-3 py-2 w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    {fetchError ? `Failed to load employees: ${fetchError}` : "No employees found."}
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.employeeId} className="border-t">
                    <td className="px-3 py-2 font-medium text-center">{employee.empName}</td>
                    <td className="px-3 py-2 text-center">{employee.mobile}</td>
                    <td className="px-3 py-2 text-center">{employee.designation || "-"}</td>
                    <td className="px-3 py-2 text-center">{employee.salaryPerday || 0}</td>
                    <td className="px-3 py-2 text-center">{formatDateDDMMYY(employee.startDate) || "-"}</td>
                    <td className="px-3 py-2 text-center">{employee.isAttendanceEligible ? "Enabled" : "Disabled"}</td>
                    <td className="px-3 py-2 text-center">{employee.facePhotoUrl ? "Uploaded" : "Missing"}</td>
                    <td className="px-3 py-2 text-center">{employee.isTechnician ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => loadEmployeeIntoForm(employee)}
                          disabled={isSaving}
                          aria-label="Edit"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFromList(employee.employeeId)}
                          disabled={isSaving}
                          aria-label="Delete"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sticky-form-actions flex justify-center mt-6">
          <Button
            type="button"
            onClick={handleAddNew}
            disabled={isSaving}
            className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent px-3 py-2 rounded-md text-sm"
            variant="ghost"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-3xl lg:max-w-5xl max-h-[98vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {editingEmployeeId ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployeeId ? "Update employee details." : "Enter employee details to create a new record."}
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-1 items-start">
              <div className="space-y-2">
                <Label htmlFor="employee-emp-name">Emp Name</Label>
                <Input
                  id="employee-emp-name"
                  value={form.empName}
                  onChange={(event) => setForm((prev) => ({ ...prev, empName: event.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-id-number">ID Number</Label>
                <Input
                  id="employee-id-number"
                  value={form.idNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, idNumber: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-mobile">Mobile</Label>
                <Input
                  id="employee-mobile"
                  value={form.mobile}
                  onChange={(event) => setForm((prev) => ({ ...prev, mobile: normalizeMobileNumber(event.target.value) }))}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="employee-address">Address</Label>
                <Textarea
                  id="employee-address"
                  value={form.address}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                  rows={3}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-designation">Designation</Label>
                <Input
                  id="employee-designation"
                  value={form.designation}
                  onChange={(event) => setForm((prev) => ({ ...prev, designation: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-salary">Salary Per Day</Label>
                <Input
                  id="employee-salary"
                  type="number"
                  min={0}
                  value={form.salaryPerday}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, salaryPerday: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-start-date">Start Date</Label>
                <DatePickerInput
                  id="employee-start-date"
                  value={form.startDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                  format="iso"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handlePhotoUpload(file)
                    }
                    event.currentTarget.value = ""
                  }}
                />
                <div className="flex items-start justify-between gap-4 pt-2">
                  <div className="flex flex-col items-start gap-1 shrink-0" style={{ width: "2.75cm" }}>
                    <div
                      className="rounded-md border overflow-hidden bg-slate-50 w-full"
                      style={{ height: "3cm" }}
                    >
                      <img
                        src={form.facePhotoUrl || "/dummy-profile.svg"}
                        alt="Employee face"
                        className={form.facePhotoUrl ? "h-full w-full object-cover" : "h-full w-full object-contain p-4"}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-auto p-0 bg-transparent text-blue-600 hover:bg-blue-50 hover:text-blue-700 justify-center gap-1"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isSaving}
                      aria-label={form.facePhotoUrl ? "Update employee photo" : "Add employee photo"}
                    >
                      <Plus className="h-4 w-4" />
                      {form.facePhotoUrl ? "Update Photo" : "Add Photo"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employee-is-technician"
                        checked={form.isTechnician}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, isTechnician: checked === true }))
                        }
                      />
                      <Label htmlFor="employee-is-technician">Mark this employee as Technician</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employee-attendance-eligible"
                        checked={form.isAttendanceEligible}
                        disabled={isAdminDesignation}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, isAttendanceEligible: checked === true }))
                        }
                      />
                      <Label htmlFor="employee-attendance-eligible">
                        Allow this employee to use mobile attendance
                      </Label>
                    </div>

                    {isAdminDesignation ? (
                      <p className="text-xs text-muted-foreground pl-6">
                        Admin-designated employees are excluded from mobile attendance automatically.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>

            <DialogFooter className="flex gap-5 justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleModalOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSaving ? "Saving..." : editingEmployeeId ? "Update" : "Save"}
              </Button>
              {editingEmployeeId ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleArchive}
                  disabled={isSaving}
                >
                  Archive Employee
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
