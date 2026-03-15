import { NextResponse } from "next/server"
import { saveUploadedFile } from "@/lib/upload-storage"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const employeeId = String(formData.get("employeeId") || "employee")
    const action = String(formData.get("action") || "attendance")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attendance evidence file is required" }, { status: 400 })
    }

    const isVideo = file.type.startsWith("video/")
    const isImage = file.type.startsWith("image/")

    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "Only image or video uploads are supported" }, { status: 400 })
    }

    const maxBytes = isVideo ? 20 * 1024 * 1024 : 6 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: isVideo ? "Video must be 20 MB or smaller" : "Image must be 6 MB or smaller" },
        { status: 400 }
      )
    }

    const videoUrl = await saveUploadedFile(file, "attendance-videos", `${employeeId}-${action}`)
    return NextResponse.json({ videoUrl })
  } catch (error) {
    console.error("[UPLOAD_ATTENDANCE_VIDEO_POST]", error)
    return NextResponse.json({ error: "Failed to upload attendance video" }, { status: 500 })
  }
}