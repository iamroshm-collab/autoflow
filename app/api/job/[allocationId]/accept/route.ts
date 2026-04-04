import { NextRequest, NextResponse } from "next/server"
import { acceptJobAllocation } from "@/services/jobAllocationService"
import { createRoleNotifications } from "@/lib/app-notifications"
import { sendTechnicianAcceptedNotification } from "@/services/notificationService"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  try {
    const { allocationId } = await params
    if (!allocationId) {
      return NextResponse.json({ error: "allocationId is required" }, { status: 400 })
    }

    const allocation = await acceptJobAllocation(allocationId)
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || request.nextUrl.origin

    await createRoleNotifications(["admin", "manager"], {
      title: "Job Accepted",
      body: `${allocation.employee?.empName || "Technician"} accepted ${allocation.jobCard?.vehicle?.registrationNumber || "a job"}`,
      url: `/job/${allocation.jobId}`,
      type: "job_accepted",
      refType: "jobcard",
      refId: allocation.jobId,
    })

    void sendTechnicianAcceptedNotification(serverUrl, {
      allocationId: allocation.id,
      jobId: allocation.jobId,
      technicianName: allocation.employee?.empName || "Technician",
      vehicleNumber: allocation.jobCard?.vehicle?.registrationNumber || "Unknown vehicle",
    }).catch((error) => {
      console.error("[JOB_ACCEPT_NOTIFICATION]", error)
    })

    return NextResponse.json({ success: true, allocation })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to accept job" },
      { status: 500 }
    )
  }
}
