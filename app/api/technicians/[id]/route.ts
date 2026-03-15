import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/technicians/[id]
 * Get a specific technician by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: 'Invalid technician id' },
        { status: 400 }
      );
    }

    const technician = await prisma.employee.findFirst({
      where: { employeeId: id, isTechnician: true },
      include: {
        _count: {
          select: {
            technicianAllocations: true,
          },
        },
      },
    });

    if (!technician) {
      return NextResponse.json(
        { error: 'Technician not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      technician: {
        id: technician.employeeId,
        employeeId: technician.employeeId,
        name: technician.empName,
        phone: technician.mobile,
        isActive: !technician.isArchived,
        technicianAllocationsCount: technician._count.technicianAllocations,
      },
    });
  } catch (error: any) {
    console.error('Error fetching technician:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch technician' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/technicians/[id]
 * Update a technician
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: 'Invalid technician id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, phone, isActive } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.empName = name;
    if (phone !== undefined) updateData.mobile = phone;
    if (isActive !== undefined) updateData.isArchived = !Boolean(isActive);
    updateData.isTechnician = true;

    const technician = await prisma.employee.update({
      where: { employeeId: id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Technician updated successfully',
      technician: {
        id: technician.employeeId,
        employeeId: technician.employeeId,
        name: technician.empName,
        phone: technician.mobile,
        isActive: !technician.isArchived,
      },
    });
  } catch (error: any) {
    console.error('Error updating technician:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update technician' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/technicians/[id]
 * Delete a technician (soft delete by setting isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: 'Invalid technician id' },
        { status: 400 }
      );
    }

    // Soft remove technician role from employee
    const technician = await prisma.employee.update({
      where: { employeeId: id },
      data: { isTechnician: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Technician role removed successfully',
      technician: {
        id: technician.employeeId,
        employeeId: technician.employeeId,
        name: technician.empName,
        phone: technician.mobile,
        isActive: !technician.isArchived,
      },
    });
  } catch (error: any) {
    console.error('Error deleting technician:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete technician' },
      { status: 500 }
    );
  }
}
