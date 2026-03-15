import { mkdir, writeFile } from "fs/promises"
import path from "path"

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-")
}

export async function saveUploadedFile(file: File, folderName: string, namePrefix: string) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const extension = path.extname(file.name || "") || ""
  const fileName = `${sanitizeSegment(namePrefix)}-${Date.now()}${extension}`
  const absoluteFolder = path.join(process.cwd(), "public", "uploads", folderName)

  await mkdir(absoluteFolder, { recursive: true })
  await writeFile(path.join(absoluteFolder, fileName), bytes)

  return `/uploads/${folderName}/${fileName}`
}