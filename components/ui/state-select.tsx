"use client"

import React from "react"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

type StateOption = [string, string]

const STATE_OPTIONS: StateOption[] = [
  ["","Select state"],
  ["1","Jammu & Kashmir"],
  ["2","Himachal Pradesh"],
  ["3","Punjab"],
  ["4","Chandigarh"],
  ["5","Uttarakhand"],
  ["6","Haryana"],
  ["7","Delhi"],
  ["8","Rajasthan"],
  ["9","Uttar Pradesh"],
  ["10","Bihar"],
  ["11","Sikkim"],
  ["12","Arunachal Pradesh"],
  ["13","Nagaland"],
  ["14","Manipur"],
  ["15","Mizoram"],
  ["16","Tripura"],
  ["17","Meghalaya"],
  ["18","Assam"],
  ["19","West Bengal"],
  ["20","Jharkhand"],
  ["21","Odisha"],
  ["22","Chhattisgarh"],
  ["23","Madhya Pradesh"],
  ["24","Gujarat"],
  ["26","Dadra & Nagar Haveli and Daman & Diu"],
  ["27","Maharashtra"],
  ["29","Karnataka"],
  ["30","Goa"],
  ["31","Lakshadweep"],
  ["32","Kerala"],
  ["33","Tamil Nadu"],
  ["34","Puducherry"],
  ["35","Andaman & Nicobar Islands"],
  ["36","Telangana"],
  ["37","Andhra Pradesh (New)"],
  ["38","Ladakh"],
  ["97","Other Territory"],
  ["99","Centre Jurisdiction"],
]

interface StateSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export default function StateSelect({ value, onChange, disabled, className }: StateSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} disabled={disabled}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        {STATE_OPTIONS.map(([code, name]) => {
          if (code === "") {
            return (
              <div key="placeholder" className="py-1.5 pl-8 pr-2 text-sm font-semibold">{name}</div>
            )
          }

          return (
            <SelectItem key={code} value={code}>
              {`${code} - ${name}`}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
