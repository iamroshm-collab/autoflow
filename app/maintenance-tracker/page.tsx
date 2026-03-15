import MaintenanceTracker from "@/components/maintenance/maintenance-tracker"

export const metadata = {
  title: "Maintenance Tracker | Garage Management",
  description: "Track vehicle maintenance and service records",
}

export default function MaintenanceTrackerPage() {
  return (
    <div className="container mx-auto py-8">
      <MaintenanceTracker />
    </div>
  )
}
