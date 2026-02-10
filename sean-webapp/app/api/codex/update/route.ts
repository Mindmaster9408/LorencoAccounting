import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { id, title, contentText, primaryDomain, secondaryDomains, layer } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Find the existing item
    const existing = await prisma.knowledgeItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Codex item not found" }, { status: 404 });
    }

    // Update the item
    const updated = await prisma.knowledgeItem.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(contentText && { contentText }),
        ...(primaryDomain && { primaryDomain }),
        ...(secondaryDomains && { secondaryDomains: JSON.stringify(secondaryDomains) }),
        ...(layer && { layer }),
      },
    });

    // Log the update
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "KB_UPDATE",
        entityType: "KnowledgeItem",
        entityId: id,
        detailsJson: JSON.stringify({
          citationId: existing.citationId,
          changes: { title, contentText, primaryDomain, secondaryDomains, layer },
        }),
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Codex update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
