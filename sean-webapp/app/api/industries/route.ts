// app/api/industries/route.ts
// Industries API - for assigning industries to companies

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { getIndustries, seedIndustries, INDUSTRIES } from "@/lib/industry-learning";

// GET /api/industries - List all industries
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    // Ensure industries are seeded
    await seedIndustries();

    const industries = await getIndustries();

    // Group by parent for hierarchical display
    const grouped = {
      all: industries,
      byParent: INDUSTRIES.reduce((acc, ind) => {
        const parent = ind.parent || "root";
        if (!acc[parent]) acc[parent] = [];
        acc[parent].push(ind.code);
        return acc;
      }, {} as Record<string, string[]>),
    };

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("[Industries API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch industries" },
      { status: 500 }
    );
  }
}

// POST /api/industries/seed - Seed industries (admin)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    await seedIndustries();

    return NextResponse.json({ success: true, message: "Industries seeded" });
  } catch (error) {
    console.error("[Industries API] Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed industries" },
      { status: 500 }
    );
  }
}
