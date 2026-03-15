const { PrismaClient } = require('@prisma/client')
;(async () => {
  const prisma = new PrismaClient()
  try {
    const target = new Date()
    target.setHours(0, 0, 0, 0)
    const next = new Date(target)
    next.setDate(next.getDate() + 1)

    const rows = await prisma.attendancePayroll.findMany({
      where: {
        attendanceDate: {
          gte: target,
          lt: next,
        },
      },
      include: { employee: true },
    })

    console.log(`Found ${rows.length} attendance rows for ${target.toISOString().slice(0,10)}`)
    console.log(JSON.stringify(rows, null, 2))
  } catch (err) {
    console.error('Error querying attendance:', err)
    process.exitCode = 1
  } finally {
    try { await prisma.$disconnect() } catch (e) {}
  }
})()
