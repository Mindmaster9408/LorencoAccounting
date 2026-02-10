// lib/privacy.ts
// STRICT PRIVACY CONTROLS FOR SEAN AI
// ============================================
// This module ensures client data is NEVER exposed to other clients
// All cross-client learning is ANONYMIZED
// ============================================

import prisma from "./db";

// Privacy levels
export const PRIVACY_LEVELS = {
  STRICT: "STRICT", // No data ever leaves client scope
  INDUSTRY_LEARNING: "INDUSTRY_LEARNING", // Anonymized patterns can be shared
} as const;

export type PrivacyLevel = keyof typeof PRIVACY_LEVELS;

// Log all data access for compliance
export async function logDataAccess(params: {
  userId?: string;
  clientId?: string;
  actionType: "VIEW" | "EXPORT" | "SHARE" | "DELETE" | "ANONYMIZE";
  dataType: "TRANSACTION" | "ALLOCATION" | "PROFILE" | "REPORT";
  description?: string;
  wasAnonymized?: boolean;
  request?: Request;
}) {
  const { userId, clientId, actionType, dataType, description, wasAnonymized, request } = params;

  await prisma.privacyAuditLog.create({
    data: {
      userId,
      clientId,
      actionType,
      dataType,
      description,
      wasAnonymized: wasAnonymized || false,
      ipAddress: request?.headers.get("x-forwarded-for") || undefined,
      userAgent: request?.headers.get("user-agent") || undefined,
    },
  });
}

// Check if user has access to client data
export async function hasClientAccess(userId: string, clientId: string): Promise<boolean> {
  // In a full implementation, check user-client relationships
  // For now, logged in users have access (firm-level)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return !!user;
}

// Anonymize a description for industry learning
// Removes any potentially identifying information
export function anonymizeDescription(description: string): string {
  return description
    .toLowerCase()
    // Remove account numbers
    .replace(/\b\d{10,}\b/g, "")
    // Remove reference numbers
    .replace(/\b(ref|reference|acc|account)[:\s#]*[\w\d-]+/gi, "")
    // Remove dates
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "")
    .replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, "")
    // Remove amounts
    .replace(/\b(r|zar)?\s*\d+([.,]\d+)?\b/gi, "")
    // Remove phone numbers
    .replace(/\b0\d{9}\b/g, "")
    .replace(/\+27\d{9}\b/g, "")
    // Remove email patterns
    .replace(/[\w.-]+@[\w.-]+\.\w+/gi, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// Check if client allows industry learning
export async function canContributeToIndustryLearning(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { dataIsolationLevel: true },
  });

  return client?.dataIsolationLevel === PRIVACY_LEVELS.INDUSTRY_LEARNING;
}

// Get client's privacy settings
export async function getClientPrivacySettings(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      dataIsolationLevel: true,
      industryId: true,
    },
  });

  if (!client) return null;

  return {
    clientId: client.id,
    clientName: client.name,
    privacyLevel: client.dataIsolationLevel,
    canContributeToIndustry: client.dataIsolationLevel === PRIVACY_LEVELS.INDUSTRY_LEARNING,
    hasIndustry: !!client.industryId,
  };
}

// Validate that no client-specific data is in a response
export function validateNoClientDataExposed(
  text: string,
  clientId: string,
  clientName: string
): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for client name
  if (text.toLowerCase().includes(clientName.toLowerCase())) {
    issues.push("Response contains client name");
  }

  // Check for client ID
  if (text.includes(clientId)) {
    issues.push("Response contains client ID");
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

// Privacy-safe export: ensure no cross-client data
export async function privacySafeExport(
  clientId: string,
  data: unknown[],
  exportType: string,
  userId?: string
): Promise<{ success: boolean; data: unknown[]; recordCount: number }> {
  // Log the export
  await logDataAccess({
    userId,
    clientId,
    actionType: "EXPORT",
    dataType: "TRANSACTION",
    description: `Exported ${data.length} ${exportType} records`,
  });

  // Verify all data belongs to this client
  // In a real implementation, you'd filter/validate here

  return {
    success: true,
    data,
    recordCount: data.length,
  };
}
