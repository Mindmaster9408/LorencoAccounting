import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import {
  queryCodex,
  searchCodexItems,
  searchLookupTables,
  checkDeductibility,
} from "@/lib/codex-engine";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { query, domain, type } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Different search modes
    if (type === "lookup") {
      // Search lookup tables specifically
      const results = await searchLookupTables(query);
      return NextResponse.json({ type: "lookup", results });
    }

    if (type === "deductibility") {
      // Check deductibility for an expense
      const result = await checkDeductibility(
        domain || "INCOME_TAX",
        query,
        undefined
      );
      return NextResponse.json({ type: "deductibility", result });
    }

    // Default: full codex query
    const keywords = query.split(/\s+/).filter((w: string) => w.length > 2);
    const codexItems = await searchCodexItems(keywords, domain);
    const codexRules = await queryCodex(query, domain || "OTHER");

    return NextResponse.json({
      type: "full",
      items: codexItems.map((item) => ({
        id: item.id,
        citationId: item.citationId,
        title: item.title,
        type: item.type,
        primaryDomain: item.primaryDomain,
      })),
      rules: {
        taxRulesCount: codexRules.taxRules.length,
        vatRulesCount: codexRules.vatRules.length,
        decisionEnginesCount: codexRules.decisionEngines.length,
        hasCodifiedKnowledge: codexRules.hasCodifiedKnowledge,
      },
      formattedContext: codexRules.formattedContext,
    });
  } catch (error) {
    console.error("Codex search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
