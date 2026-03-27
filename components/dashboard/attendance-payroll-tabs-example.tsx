"use client"

import * as React from 'react'
import FolderTabs, { FolderTabItem } from '@/components/ui/folder-tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, DollarSign, Users, ClipboardList } from 'lucide-react'

/**
 * Example Attendance Form Component
 */
function AttendanceForm() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Daily Attendance Entry</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="attendance-date">Date</Label>
          <Input id="attendance-date" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee-select">Employee</Label>
          <Input id="employee-select" placeholder="Select employee..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="attendance-status">Status</Label>
          <select 
            id="attendance-status" 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="present">Present (P)</option>
            <option value="absent">Absent (A)</option>
            <option value="half-day">Half Day (H)</option>
            <option value="leave">Leave (L)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="salary-advance">Salary Advance</Label>
          <Input id="salary-advance" type="number" placeholder="0.00" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="incentive">Incentive</Label>
          <Input id="incentive" type="number" placeholder="0.00" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="allowance">Allowance</Label>
          <Input id="allowance" type="number" placeholder="0.00" />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Calendar className="mr-2 h-4 w-4" />
          Save Attendance
        </Button>
        <Button variant="outline">Cancel</Button>
      </div>

      {/* Recent Attendance Table Preview */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            Recent attendance entries will appear here...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Example Payroll Form Component
 */
function PayrollForm() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Monthly Payroll Generation</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payroll-month">Month</Label>
          <select 
            id="payroll-month" 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payroll-year">Year</Label>
          <Input id="payroll-year" type="number" defaultValue="2026" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee-payroll">Employee</Label>
          <Input id="employee-payroll" placeholder="Select employee..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="basic-salary">Basic Salary</Label>
          <Input id="basic-salary" type="number" placeholder="0.00" disabled />
        </div>
      </div>

      {/* Payroll Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Payroll Summary</CardTitle>
          <CardDescription>Calculated based on attendance records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Present Days:</span>
            <span className="font-semibold">22</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Total Allowances:</span>
            <span className="font-semibold">₹500</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Total Incentives:</span>
            <span className="font-semibold">₹300</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Total Advances:</span>
            <span className="font-semibold text-red-600">-₹1,000</span>
          </div>
          <div className="border-t border-blue-300 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-semibold">Net Salary:</span>
              <span className="font-bold text-lg text-blue-700">₹15,800</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 pt-4">
        <Button className="bg-blue-600 hover:bg-blue-700">
          <ClipboardList className="mr-2 h-4 w-4" />
          Generate Payroll
        </Button>
        <Button variant="outline">View Report</Button>
      </div>
    </div>
  )
}

/**
 * Main Attendance & Payroll Tabs Component
 * Uses the FolderTabs component with classic folder-tab design
 */
export default function AttendancePayrollTabs() {
  const tabItems: FolderTabItem[] = [
    {
      value: 'attendance',
      label: (
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Attendance
        </span>
      ),
      content: <AttendanceForm />,
    },
    {
      value: 'payroll',
      label: (
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Payroll
        </span>
      ),
      content: <PayrollForm />,
    },
  ]

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <FolderTabs 
        items={tabItems} 
        defaultValue="attendance"
      />
    </div>
  )
}
