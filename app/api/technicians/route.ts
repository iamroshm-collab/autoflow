import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/technicians
 * List all technicians
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const search = (searchParams.get('search') || '').trim();

    const technicians = await prisma.employee.findMany({
      where: {
        isTechnician: true,
        ...(isActive !== null && { isArchived: !(isActive === 'true') }),
        ...(search
          ? {
              OR: [
                { empName: { contains: search } },
                { mobile: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { empName: 'asc' },
      include: {
        _count: {
          select: {
            technicianAllocations: {
              where: {
                status: {
                  in: ['assigned', 'accepted', 'in_progress'],
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        technicians: technicians.map((employee) => ({
          id: employee.employeeId,
          employeeId: employee.employeeId,
          name: employee.empName,
          phone: employee.mobile,
          isActive: !employee.isArchived,
          technicianAllocationsCount: employee._count.technicianAllocations,
        })),
      }
    );
  } catch (error: any) {
    console.error('Error fetching technicians:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch technicians' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/technicians
 * Create a new technician
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, isActive = true } = body;

    const parsedEmployeeId = Number(employeeId);
    if (!Number.isInteger(parsedEmployeeId)) {
      return NextResponse.json(
        { error: 'employeeId is required and must be a valid number' },
        { status: 400 }
      );
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId: parsedEmployeeId },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const technician = await prisma.employee.update({
      where: { employeeId: parsedEmployeeId },
      data: {
        isTechnician: true,
        isArchived: isActive ? false : existingEmployee.isArchived,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Employee marked as technician successfully',
        technician: {
          id: technician.employeeId,
          employeeId: technician.employeeId,
          name: technician.empName,
          phone: technician.mobile,
          isActive: !technician.isArchived,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating technician:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create technician' },
      { status: 500 }
    );
  }
}
