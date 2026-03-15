import { redirect } from "next/navigation"

export default async function JobRedirectPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params
  redirect(`/tech?jobId=${encodeURIComponent(jobId)}`)
}
