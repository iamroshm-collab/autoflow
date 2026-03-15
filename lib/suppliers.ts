type Subscriber = () => void

const subscribers = new Set<Subscriber>()

export function subscribeSuppliers(cb: Subscriber) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

export function notifySuppliersChanged() {
  subscribers.forEach((cb) => {
    try {
      cb()
    } catch (e) {
      // ignore
    }
  })
}

export default {
  subscribeSuppliers,
  notifySuppliersChanged,
}
