import { notify } from '@/components/ui/notify'

export function startAction(message = 'Processing...') {
  try {
    return notify.show(message)
  } catch {
    return null
  }
}

export function successAction(message = 'Done') {
  try {
    notify.success(message)
  } catch {}
}

export function errorAction(message: string | Error = 'Something went wrong') {
  try {
    const text = message instanceof Error ? message.message : String(message)
    notify.error(text)
  } catch {}
}
