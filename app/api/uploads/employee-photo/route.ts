import { NextResponse } from "next/server"
import { saveUploadedFile } from "@/lib/upload-storage"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const employeeName = String(formData.get("employeeName") || "employee")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Photo file is required" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo must be 5 MB or smaller" }, { status: 400 })
    }

    const photoUrl = await saveUploadedFile(file, "employee-photos", employeeName)
    return NextResponse.json({ photoUrl })
  } catch (error) {
    console.error("[UPLOAD_EMPLOYEE_PHOTO_POST]", error)
    return NextResponse.json({ error: "Failed to upload employee photo" }, { status: 500 })
  }
}