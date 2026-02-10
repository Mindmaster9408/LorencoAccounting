// app/api/industries/[industryId]/route.ts
// Industry detail API - patterns and expectations

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { getIndustryWithPatterns, getIndustryExpectations } from "@/lib/industry-learning";
import prisma from "@/lib/db";

// GET /api/industries/[industryId] - Get industry details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ industryId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { industryId } = await params;

    const industry = await getIndustryWithPatterns(industryId);
    if (!industry) {
      return NextResponse.json({ error: "Industry not found" }, { status: 404 });
    }

    const expectations = await getIndustryExpectations(industryId);

    return NextResponse.json({
      industry: {
        id: industry.id,
        code: industry.code,
        name: industry.name,
        clientCount: industry._count.clients,
      },
      patterns: industry.industryPatterns.map((p) => ({
        pattern: p.normalizedPattern,
        category: p.suggestedCategory,
        confidence: p.confidence,
        occurrences: p.occurrenceCount,
      })),
      expectations,
    });
  } catch (error) {
    console.error("[Industry Detail API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch industry details" },
      { status: 500 }
    );
  }
}

// PATCH /api/industries/[industryId] - Update industry expectations (admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ industryId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { industryId } = await params;
    const body = await request.json();

    const updateData: Record<string, string> = {};

    if (body.typicalExpenses) {
      updateData.typicalExpenses = JSON.stringify(body.typicalExpenses);
    }
    if (body.typicalIncome) {
      updateData.typicalIncome = JSON.stringify(body.typicalIncome);
    }
    if (body.commonVendors) {
      updateData.commonVendors = JSON.stringify(body.commonVendors);
    }

    const updated = await prisma.industry.update({
      where: { id: industryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      industry: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
      },
    });
  } catch (error) {
    console.error("[Industry Detail API] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update industry" },
      { status: 500 }
    );
  }
}
