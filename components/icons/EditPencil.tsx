'use client'

import * as React from 'react'

export default function EditPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      {...props}
    >
      <path d="M3 21l3-1 11-11a2.828 2.828 0 0 0 0-4l-1-1a2.828 2.828 0 0 0-4 0L1 14v6z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}
