// lib/industry-learning.ts
// ANONYMIZED INDUSTRY LEARNING
// ============================================
// Sean learns allocation patterns by INDUSTRY, not by company
// When a new company joins, Sean already knows patterns for their industry
// WITHOUT ever revealing any other company's data
// ============================================

import prisma from "./db";
import { anonymizeDescription, canContributeToIndustryLearning, logDataAccess } from "./privacy";
import { normalizeDescription } from "./bank-allocations";

// South African Industry Types
export const INDUSTRIES = [
  // Professional Services
  { code: "ACCOUNTING", name: "Accounting & Tax Services", parent: null },
  { code: "LEGAL", name: "Legal Services", parent: null },
  { code: "CONSULTING", name: "Business Consulting", parent: null },
  { code: "MEDICAL", name: "Medical Practice", parent: null },
  { code: "DENTAL", name: "Dental Practice", parent: "MEDICAL" },
  { code: "VETERINARY", name: "Veterinary Services", parent: "MEDICAL" },

  // Retail
  { code: "RETAIL", name: "Retail - General", parent: null },
  { code: "RETAIL_CLOTHING", name: "Retail - Clothing & Fashion", parent: "RETAIL" },
  { code: "RETAIL_FOOD", name: "Retail - Food & Groceries", parent: "RETAIL" },
  { code: "RETAIL_ELECTRONICS", name: "Retail - Electronics", parent: "RETAIL" },
  { code: "RETAIL_HARDWARE", name: "Retail - Hardware & Building", parent: "RETAIL" },

  // Services
  { code: "IT_SERVICES", name: "IT Services & Consulting", parent: null },
  { code: "IT_RETAIL", name: "IT Retail & Hardware Sales", parent: "IT_SERVICES" },
  { code: "SECURITY", name: "Security Services", parent: null },
  { code: "CLEANING", name: "Cleaning Services", parent: null },
  { code: "TRANSPORT", name: "Transport & Logistics", parent: null },
  { code: "COURIER", name: "Courier Services", parent: "TRANSPORT" },

  // Construction & Property
  { code: "CONSTRUCTION", name: "Construction", parent: null },
  { code: "ELECTRICAL", name: "Electrical Contractor", parent: "CONSTRUCTION" },
  { code: "PLUMBING", name: "Plumbing Contractor", parent: "CONSTRUCTION" },
  { code: "PROPERTY", name: "Property & Real Estate", parent: null },
  { code: "PROPERTY_RENTAL", name: "Property Rental", parent: "PROPERTY" },

  // Manufacturing
  { code: "MANUFACTURING", name: "Manufacturing - General", parent: null },
  { code: "FOOD_PRODUCTION", name: "Food Production", parent: "MANUFACTURING" },

  // Hospitality
  { code: "HOSPITALITY", name: "Hospitality - General", parent: null },
  { code: "RESTAURANT", name: "Restaurant & Catering", parent: "HOSPITALITY" },
  { code: "ACCOMMODATION", name: "Accommodation & B&B", parent: "HOSPITALITY" },

  // Agriculture
  { code: "AGRICULTURE", name: "Agriculture & Farming", parent: null },

  // Other
  { code: "NPO", name: "Non-Profit Organization", parent: null },
  { code: "OTHER", name: "Other", parent: null },
] as const;

// Seed industries into database
export async function seedIndustries() {
  for (const industry of INDUSTRIES) {
    const existing = await prisma.industry.findUnique({
      where: { code: industry.code },
    });

    if (!existing) {
      // Find parent ID if specified
      let parentId: string | null = null;
      if (industry.parent) {
        const parent = await prisma.industry.findUnique({
          where: { code: industry.parent },
        });
        parentId = parent?.id || null;
      }

      await prisma.industry.create({
        data: {
          code: industry.code,
          name: industry.name,
          parentId,
        },
      });
    }
  }
}

// Get all industries for selection
export async function getIndustries() {
  return prisma.industry.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { clients: true } },
    },
  });
}

// Get industry with patterns
export async function getIndustryWithPatterns(industryId: string) {
  return prisma.industry.findUnique({
    where: { id: industryId },
    include: {
      industryPatterns: {
        orderBy: { occurrenceCount: "desc" },
        take: 100,
      },
      _count: { select: { clients: true } },
    },
  });
}

// ============================================
// CONTRIBUTE TO INDUSTRY LEARNING (ANONYMIZED)
// This is called when a client confirms an allocation
// ============================================
export async function contributeToIndustryLearning(params: {
  clientId: string;
  description: string;
  category: string;
  userId?: string;
}): Promise<{ contributed: boolean; reason?: string }> {
  const { clientId, description, category, userId } = params;

  // Check if client allows industry learning
  const canContribute = await canContributeToIndustryLearning(clientId);
  if (!canContribute) {
    return { contributed: false, reason: "Client privacy level is STRICT" };
  }

  // Get client's industry
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { industryId: true },
  });

  if (!client?.industryId) {
    return { contributed: false, reason: "Client has no industry assigned" };
  }

  // ANONYMIZE the description - remove ALL identifying info
  const anonymized = anonymizeDescription(description);
  const normalized = normalizeDescription(anonymized);

  // Skip if too short after anonymization
  if (normalized.length < 3) {
    return { contributed: false, reason: "Description too generic after anonymization" };
  }

  // Check if pattern exists for this industry
  const existing = await prisma.industryPattern.findUnique({
    where: {
      industryId_normalizedPattern: {
        industryId: client.industryId,
        normalizedPattern: normalized,
      },
    },
  });

  if (existing) {
    // Update occurrence count (NOT who contributed!)
    await prisma.industryPattern.update({
      where: { id: existing.id },
      data: {
        occurrenceCount: { increment: 1 },
        confidence: Math.min(0.95, existing.confidence + 0.02),
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new anonymous pattern
    await prisma.industryPattern.create({
      data: {
        industryId: client.industryId,
        normalizedPattern: normalized,
        suggestedCategory: category,
        confidence: 0.5, // Start low, build over time
        occurrenceCount: 1,
      },
    });
  }

  // Update industry contributor count (just a number, no names!)
  await prisma.industry.update({
    where: { id: client.industryId },
    data: { learningContributors: { increment: 1 } },
  });

  // Log the anonymized contribution
  await logDataAccess({
    userId,
    clientId,
    actionType: "ANONYMIZE",
    dataType: "ALLOCATION",
    description: "Contributed anonymized pattern to industry learning",
    wasAnonymized: true,
  });

  return { contributed: true };
}

// ============================================
// GET INDUSTRY SUGGESTIONS
// Use industry patterns to suggest allocations for NEW companies
// ============================================
export async function getIndustrySuggestion(params: {
  description: string;
  industryId: string;
}): Promise<{
  category: string | null;
  confidence: number;
  source: "industry";
  industryName?: string;
} | null> {
  const { description, industryId } = params;

  const normalized = normalizeDescription(description);

  // Find matching pattern in this industry
  const pattern = await prisma.industryPattern.findFirst({
    where: {
      industryId,
      normalizedPattern: normalized,
    },
    include: {
      industry: { select: { name: true } },
    },
  });

  if (pattern && pattern.confidence >= 0.5) {
    return {
      category: pattern.suggestedCategory,
      confidence: pattern.confidence,
      source: "industry",
      industryName: pattern.industry.name,
    };
  }

  // Try fuzzy match within industry
  const allPatterns = await prisma.industryPattern.findMany({
    where: { industryId },
    orderBy: { occurrenceCount: "desc" },
    take: 200,
  });

  const keywords = normalized.split(" ").filter((w) => w.length > 2);

  let bestMatch: (typeof allPatterns)[0] | null = null;
  let bestScore = 0;

  for (const p of allPatterns) {
    const patternKeywords = p.normalizedPattern.split(" ").filter((w) => w.length > 2);
    const overlap = keywords.filter((k) =>
      patternKeywords.some((pk) => pk.includes(k) || k.includes(pk))
    ).length;
    const score = overlap / Math.max(keywords.length, patternKeywords.length);

    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch) {
    return {
      category: bestMatch.suggestedCategory,
      confidence: bestScore * bestMatch.confidence * 0.8, // Lower confidence for fuzzy
      source: "industry",
    };
  }

  return null;
}

// ============================================
// GET EXPECTED EXPENSE BREAKDOWN FOR INDUSTRY
// Help Sean understand what's "normal" for this type of business
// ============================================
export async function getIndustryExpectations(industryId: string) {
  const industry = await prisma.industry.findUnique({
    where: { id: industryId },
    select: {
      name: true,
      typicalExpenses: true,
      typicalIncome: true,
      commonVendors: true,
      learningContributors: true,
    },
  });

  if (!industry) return null;

  return {
    industryName: industry.name,
    typicalExpenses: JSON.parse(industry.typicalExpenses) as Array<{
      category: string;
      percentage: number;
    }>,
    typicalIncome: JSON.parse(industry.typicalIncome) as Array<{
      category: string;
      percentage: number;
    }>,
    commonVendors: JSON.parse(industry.commonVendors) as string[],
    dataPoints: industry.learningContributors,
  };
}

// ============================================
// UPDATE INDUSTRY EXPECTATIONS (ADMIN ONLY)
// Based on aggregated, anonymized data
// ============================================
export async function updateIndustryExpectations(
  industryId: string,
  expectations: {
    typicalExpenses?: Array<{ category: string; percentage: number }>;
    typicalIncome?: Array<{ category: string; percentage: number }>;
    commonVendors?: string[];
  }
) {
  const updateData: Record<string, string> = {};

  if (expectations.typicalExpenses) {
    updateData.typicalExpenses = JSON.stringify(expectations.typicalExpenses);
  }
  if (expectations.typicalIncome) {
    updateData.typicalIncome = JSON.stringify(expectations.typicalIncome);
  }
  if (expectations.commonVendors) {
    updateData.commonVendors = JSON.stringify(expectations.commonVendors);
  }

  await prisma.industry.update({
    where: { id: industryId },
    data: updateData,
  });
}
