/**
 * Garage departments and their associated designations.
 * Used in employee forms, approval flow, and breakdown routing.
 */

export const GARAGE_DEPARTMENTS_DESIGNATIONS: Record<string, string[]> = {
  "Mechanical": [
    "Mechanic",
    "Senior Mechanic",
    "Foreman",
    "Workshop Supervisor",
    "Helper",
    "Trainee",
  ],
  "Electrical": [
    "Auto Electrician",
    "Senior Electrician",
    "Electrical Helper",
    "Electrician",
  ],
  "AC / Air Conditioning": [
    "AC Technician",
    "Senior AC Technician",
    "AC Helper",
  ],
  "Body Shop": [
    "Panel Beater",
    "Denter",
    "Body Shop Supervisor",
    "Patch Worker",
    "Helper",
  ],
  "Paint": [
    "Painter",
    "Senior Painter",
    "Paint Helper",
    "Patch Worker",
  ],
  "Tyre & Wheel": [
    "Tyre Fitter",
    "Wheel Alignment Technician",
    "Balancing Technician",
  ],
  "Welding / Fabrication": [
    "Welder",
    "Fabricator",
    "Helper",
  ],
  "Service / Lubrication": [
    "Service Technician",
    "Lubrication Technician",
    "Service Advisor",
    "Wash Boy",
  ],
  "Inspection / QC": [
    "Quality Inspector",
    "Vehicle Inspector",
    "QC Supervisor",
  ],
  "Spare Parts": [
    "Parts Manager",
    "Store Keeper",
    "Parts Executive",
    "Inventory Assistant",
  ],
  "Reception": [
    "Receptionist",
    "Customer Service Executive",
    "Service Advisor",
    "Office Boy",
  ],
  "Accounts": [
    "Accountant",
    "Senior Accountant",
    "Accounts Executive",
    "Cashier",
  ],
  "Administration": [
    "HR Manager",
    "Office Manager",
    "Admin Executive",
    "Office Boy",
    "Driver",
  ],
  "Management": [
    "General Manager",
    "Workshop Manager",
    "Manager",
    "Supervisor",
    "Director",
  ],
}

export const GARAGE_DEPARTMENTS = Object.keys(GARAGE_DEPARTMENTS_DESIGNATIONS)

/** Returns designations for a given department, or all unique designations if no department given. */
export function getDesignationsForDepartment(department: string): string[] {
  if (department && GARAGE_DEPARTMENTS_DESIGNATIONS[department]) {
    return GARAGE_DEPARTMENTS_DESIGNATIONS[department]
  }
  // Fallback: all designations de-duped
  const all = Object.values(GARAGE_DEPARTMENTS_DESIGNATIONS).flat()
  return [...new Set(all)].sort()
}
