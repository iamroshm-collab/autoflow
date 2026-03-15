import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const summary = await prisma.itcLedger.groupBy({
      by: ["branchId"],
      _sum: {
        igstCredit: true,
        cgstCredit: true,
        sgstCredit: true,
        utilizedIgst: true,
        utilizedCgst: true,
        utilizedSgst: true,
        balanceIgst: true,
        balanceCgst: true,
        balanceSgst: true,
      },
    })

    const branches = await prisma.branch.findMany({
      select: { id: true, branchName: true, stateCode: true, gstin: true },
    })

    const branchesById = Object.fromEntries(branches.map((b) => [b.id, b]))

    const enriched = summary.map((row) => ({
      branchId: row.branchId,
      branchName: branchesById[row.branchId]?.branchName || "",
      stateCode: branchesById[row.branchId]?.stateCode || "",
      gstin: branchesById[row.branchId]?.gstin || "",
      igstCredit: Number(row._sum.igstCredit || 0),
      cgstCredit: Number(row._sum.cgstCredit || 0),
      sgstCredit: Number(row._sum.sgstCredit || 0),
      utilizedIgst: Number(row._sum.utilizedIgst || 0),
      utilizedCgst: Number(row._sum.utilizedCgst || 0),
      utilizedSgst: Number(row._sum.utilizedSgst || 0),
      balanceIgst: Number(row._sum.balanceIgst || 0),
      balanceCgst: Number(row._sum.balanceCgst || 0),
      balanceSgst: Number(row._sum.balanceSgst || 0),
    }))

    return NextResponse.json({ branches: enriched })
  } catch (error) {
    console.error("[ITC_SUMMARY]", error)
    return NextResponse.json({ error: "Failed to generate ITC summary" }, { status: 500 })
  }
}
