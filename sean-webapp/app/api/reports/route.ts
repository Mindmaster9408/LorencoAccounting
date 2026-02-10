import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { ALLOCATION_CATEGORIES } from "@/lib/bank-allocations";

// Report Types
type ReportType = "trial_balance" | "income_statement" | "allocations_summary" | "vat_report";

interface ReportFilter {
  clientId?: string;
  startDate?: string;
  endDate?: string;
  format?: "json" | "csv";
}

// Generate Trial Balance Report
async function generateTrialBalance(filter: ReportFilter) {
  const where: Record<string, unknown> = { processed: true, confirmedCategory: { not: null } };

  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.startDate || filter.endDate) {
    where.date = {};
    if (filter.startDate) (where.date as Record<string, unknown>).gte = new Date(filter.startDate);
    if (filter.endDate) (where.date as Record<string, unknown>).lte = new Date(filter.endDate);
  }

  const transactions = await prisma.bankTransaction.findMany({
    where,
    orderBy: { date: "asc" },
  });

  // Group by category and calculate totals
  const categoryTotals: Record<string, { debit: number; credit: number }> = {};

  for (const tx of transactions) {
    const cat = tx.confirmedCategory || "OTHER";
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { debit: 0, credit: 0 };
    }
    if (tx.isDebit) {
      categoryTotals[cat].debit += Math.abs(tx.amount);
    } else {
      categoryTotals[cat].credit += Math.abs(tx.amount);
    }
  }

  // Format as trial balance
  const entries = Object.entries(categoryTotals).map(([code, totals]) => {
    const catInfo = ALLOCATION_CATEGORIES.find(c => c.code === code);
    return {
      accountCode: code,
      accountName: catInfo?.label || code,
      debit: totals.debit,
      credit: totals.credit,
      balance: totals.debit - totals.credit,
    };
  });

  // Calculate totals
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  return {
    type: "trial_balance",
    period: {
      start: filter.startDate || "All time",
      end: filter.endDate || "Current",
    },
    entries: entries.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      difference: totalDebit - totalCredit,
    },
    transactionCount: transactions.length,
    generatedAt: new Date().toISOString(),
  };
}

// Generate Income Statement
async function generateIncomeStatement(filter: ReportFilter) {
  const where: Record<string, unknown> = { processed: true, confirmedCategory: { not: null } };

  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.startDate || filter.endDate) {
    where.date = {};
    if (filter.startDate) (where.date as Record<string, unknown>).gte = new Date(filter.startDate);
    if (filter.endDate) (where.date as Record<string, unknown>).lte = new Date(filter.endDate);
  }

  const transactions = await prisma.bankTransaction.findMany({
    where,
    orderBy: { date: "asc" },
  });

  // Income categories
  const incomeCategories = ["REVENUE", "INTEREST_RECEIVED", "DEBTOR_RECEIPT", "REFUND"];
  // Direct cost categories
  const directCostCategories = ["STOCK_PURCHASES", "CREDITOR_PAYMENT"];
  // Operating expense categories
  const expenseCategories = ALLOCATION_CATEGORIES
    .map(c => c.code)
    .filter(c => !incomeCategories.includes(c) && !directCostCategories.includes(c) && !["CAPITAL", "DRAWINGS", "LOAN_REPAYMENT", "VAT_INPUT", "VAT_OUTPUT", "VAT_PAYMENT"].includes(c));

  const categoryTotals: Record<string, number> = {};

  for (const tx of transactions) {
    const cat = tx.confirmedCategory || "OTHER";
    if (!categoryTotals[cat]) categoryTotals[cat] = 0;
    categoryTotals[cat] += tx.isDebit ? -Math.abs(tx.amount) : Math.abs(tx.amount);
  }

  // Build income statement
  const income = incomeCategories
    .filter(c => categoryTotals[c])
    .map(c => ({
      code: c,
      label: ALLOCATION_CATEGORIES.find(cat => cat.code === c)?.label || c,
      amount: Math.abs(categoryTotals[c] || 0),
    }));

  const directCosts = directCostCategories
    .filter(c => categoryTotals[c])
    .map(c => ({
      code: c,
      label: ALLOCATION_CATEGORIES.find(cat => cat.code === c)?.label || c,
      amount: Math.abs(categoryTotals[c] || 0),
    }));

  const expenses = expenseCategories
    .filter(c => categoryTotals[c])
    .map(c => ({
      code: c,
      label: ALLOCATION_CATEGORIES.find(cat => cat.code === c)?.label || c,
      amount: Math.abs(categoryTotals[c] || 0),
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalDirectCosts = directCosts.reduce((sum, c) => sum + c.amount, 0);
  const grossProfit = totalIncome - totalDirectCosts;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  return {
    type: "income_statement",
    period: {
      start: filter.startDate || "All time",
      end: filter.endDate || "Current",
    },
    income,
    totalIncome,
    directCosts,
    totalDirectCosts,
    grossProfit,
    expenses,
    totalExpenses,
    netProfit,
    transactionCount: transactions.length,
    generatedAt: new Date().toISOString(),
  };
}

// Generate Allocations Summary
async function generateAllocationsSummary(filter: ReportFilter) {
  const where: Record<string, unknown> = {};

  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.startDate || filter.endDate) {
    where.date = {};
    if (filter.startDate) (where.date as Record<string, unknown>).gte = new Date(filter.startDate);
    if (filter.endDate) (where.date as Record<string, unknown>).lte = new Date(filter.endDate);
  }

  const transactions = await prisma.bankTransaction.findMany({ where });

  const total = transactions.length;
  const processed = transactions.filter(t => t.processed).length;
  const confirmed = transactions.filter(t => t.confirmedCategory).length;
  const pending = total - confirmed;

  // Group by category
  const byCategory: Record<string, { count: number; totalAmount: number }> = {};
  for (const tx of transactions) {
    const cat = tx.confirmedCategory || tx.suggestedCategory || "UNALLOCATED";
    if (!byCategory[cat]) byCategory[cat] = { count: 0, totalAmount: 0 };
    byCategory[cat].count++;
    byCategory[cat].totalAmount += Math.abs(tx.amount);
  }

  // Confidence distribution
  const confidenceRanges = {
    high: transactions.filter(t => (t.suggestedConfidence || 0) >= 0.8).length,
    medium: transactions.filter(t => (t.suggestedConfidence || 0) >= 0.5 && (t.suggestedConfidence || 0) < 0.8).length,
    low: transactions.filter(t => (t.suggestedConfidence || 0) > 0 && (t.suggestedConfidence || 0) < 0.5).length,
    none: transactions.filter(t => !t.suggestedConfidence).length,
  };

  return {
    type: "allocations_summary",
    period: {
      start: filter.startDate || "All time",
      end: filter.endDate || "Current",
    },
    summary: {
      total,
      processed,
      confirmed,
      pending,
      processedPercentage: total > 0 ? ((processed / total) * 100).toFixed(1) : "0",
      confirmedPercentage: total > 0 ? ((confirmed / total) * 100).toFixed(1) : "0",
    },
    byCategory: Object.entries(byCategory)
      .map(([code, data]) => ({
        code,
        label: ALLOCATION_CATEGORIES.find(c => c.code === code)?.label || code,
        ...data,
      }))
      .sort((a, b) => b.count - a.count),
    confidenceDistribution: confidenceRanges,
    generatedAt: new Date().toISOString(),
  };
}

// Generate VAT Report
async function generateVATReport(filter: ReportFilter) {
  const where: Record<string, unknown> = { processed: true, confirmedCategory: { not: null } };

  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.startDate || filter.endDate) {
    where.date = {};
    if (filter.startDate) (where.date as Record<string, unknown>).gte = new Date(filter.startDate);
    if (filter.endDate) (where.date as Record<string, unknown>).lte = new Date(filter.endDate);
  }

  const transactions = await prisma.bankTransaction.findMany({
    where,
    orderBy: { date: "asc" },
  });

  // VAT rate in SA
  const VAT_RATE = 0.15;

  // Categories where VAT can be claimed (input VAT)
  const vatClaimableCategories = [
    "TELEPHONE", "ELECTRICITY", "STATIONERY", "FUEL", "REPAIRS",
    "SUBSCRIPTIONS", "IT_EQUIPMENT", "FURNITURE", "STOCK_PURCHASES",
    "PROFESSIONAL_FEES", "ADVERTISING", "SECURITY", "CLEANING",
  ];

  // Output VAT on revenue
  const outputVATCategories = ["REVENUE", "DEBTOR_RECEIPT"];

  let outputVAT = 0;
  let inputVAT = 0;
  const vatableExpenses: Array<{ category: string; amount: number; vat: number }> = [];
  const vatableIncome: Array<{ category: string; amount: number; vat: number }> = [];

  // Group by category
  const categoryTotals: Record<string, number> = {};
  for (const tx of transactions) {
    const cat = tx.confirmedCategory || "OTHER";
    if (!categoryTotals[cat]) categoryTotals[cat] = 0;
    categoryTotals[cat] += Math.abs(tx.amount);
  }

  // Calculate input VAT
  for (const cat of vatClaimableCategories) {
    if (categoryTotals[cat]) {
      const inclusive = categoryTotals[cat];
      const vat = inclusive * VAT_RATE / (1 + VAT_RATE);
      inputVAT += vat;
      vatableExpenses.push({
        category: ALLOCATION_CATEGORIES.find(c => c.code === cat)?.label || cat,
        amount: inclusive,
        vat,
      });
    }
  }

  // Calculate output VAT
  for (const cat of outputVATCategories) {
    if (categoryTotals[cat]) {
      const inclusive = categoryTotals[cat];
      const vat = inclusive * VAT_RATE / (1 + VAT_RATE);
      outputVAT += vat;
      vatableIncome.push({
        category: ALLOCATION_CATEGORIES.find(c => c.code === cat)?.label || cat,
        amount: inclusive,
        vat,
      });
    }
  }

  const vatPayable = outputVAT - inputVAT;

  return {
    type: "vat_report",
    period: {
      start: filter.startDate || "All time",
      end: filter.endDate || "Current",
    },
    vatRate: `${(VAT_RATE * 100).toFixed(0)}%`,
    outputVAT: {
      total: outputVAT,
      breakdown: vatableIncome,
    },
    inputVAT: {
      total: inputVAT,
      breakdown: vatableExpenses.sort((a, b) => b.vat - a.vat),
    },
    vatPayable,
    vatRefund: vatPayable < 0 ? Math.abs(vatPayable) : 0,
    summary: vatPayable >= 0
      ? `VAT payable to SARS: R${vatPayable.toFixed(2)}`
      : `VAT refund due from SARS: R${Math.abs(vatPayable).toFixed(2)}`,
    generatedAt: new Date().toISOString(),
  };
}

// Convert report to CSV format
function toCSV(report: Record<string, unknown>): string {
  const type = report.type as string;

  if (type === "trial_balance") {
    const tb = report as ReturnType<typeof generateTrialBalance> extends Promise<infer T> ? T : never;
    let csv = "Account Code,Account Name,Debit,Credit,Balance\n";
    for (const entry of tb.entries) {
      csv += `${entry.accountCode},"${entry.accountName}",${entry.debit.toFixed(2)},${entry.credit.toFixed(2)},${entry.balance.toFixed(2)}\n`;
    }
    csv += `\nTOTAL,,${tb.totals.debit.toFixed(2)},${tb.totals.credit.toFixed(2)},${tb.totals.difference.toFixed(2)}\n`;
    return csv;
  }

  if (type === "income_statement") {
    const is = report as ReturnType<typeof generateIncomeStatement> extends Promise<infer T> ? T : never;
    let csv = "Category,Amount\n";
    csv += "INCOME\n";
    for (const i of is.income) csv += `"${i.label}",${i.amount.toFixed(2)}\n`;
    csv += `Total Income,${is.totalIncome.toFixed(2)}\n\n`;
    csv += "DIRECT COSTS\n";
    for (const c of is.directCosts) csv += `"${c.label}",${c.amount.toFixed(2)}\n`;
    csv += `Total Direct Costs,${is.totalDirectCosts.toFixed(2)}\n`;
    csv += `Gross Profit,${is.grossProfit.toFixed(2)}\n\n`;
    csv += "OPERATING EXPENSES\n";
    for (const e of is.expenses) csv += `"${e.label}",${e.amount.toFixed(2)}\n`;
    csv += `Total Expenses,${is.totalExpenses.toFixed(2)}\n\n`;
    csv += `NET PROFIT,${is.netProfit.toFixed(2)}\n`;
    return csv;
  }

  // Default: JSON-like CSV
  return JSON.stringify(report, null, 2);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") as ReportType || "allocations_summary";
    const format = searchParams.get("format") as "json" | "csv" || "json";

    const filter: ReportFilter = {
      clientId: searchParams.get("clientId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      format,
    };

    let report: Record<string, unknown>;

    switch (reportType) {
      case "trial_balance":
        report = await generateTrialBalance(filter);
        break;
      case "income_statement":
        report = await generateIncomeStatement(filter);
        break;
      case "vat_report":
        report = await generateVATReport(filter);
        break;
      case "allocations_summary":
      default:
        report = await generateAllocationsSummary(filter);
        break;
    }

    if (format === "csv") {
      const csv = toCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportType}_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
