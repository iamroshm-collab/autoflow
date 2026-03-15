'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        duration: 4000,
        style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
        classNames: {
          toast: 'group toast pointer-events-auto bg-transparent shadow-none border-none p-0',
          description: 'text-sm',
          title: 'text-sm font-semibold',
          actionButton: 'hidden',
          cancelButton: 'hidden',
        },
      }}
      position="top-right"
      offset={16}
      gap={12}
      {...props}
    />
  )
}

export { Toaster }
