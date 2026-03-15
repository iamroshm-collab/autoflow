import FolderTabs from '@/components/ui/folder-tabs'
import { AttendancePayrollModule } from "@/components/dashboard/attendance-payroll-module"

export default function AttendancePayrollPage() {
  return (
    <div className="container mx-auto p-6 max-w-[1600px] space-y-8">
      {/* Demo: Folder-style tabs (Attendance / Payroll) */}
      <FolderTabs
        defaultValue="attendance"
        items={[
          {
            value: 'attendance',
            label: 'Attendance',
            content: (
              <div className="text-sm text-slate-700">
                Attendance form goes here — mount your attendance form component inside this tab.
              </div>
            ),
          },
          {
            value: 'payroll',
            label: 'Payroll',
            content: (
              <div className="text-sm text-slate-700">
                Payroll form goes here — mount your payroll form or summary here.
              </div>
            ),
          },
        ]}
      />

      {/* Existing, full-featured module remains below */}
      <AttendancePayrollModule />
    </div>
  )
}
