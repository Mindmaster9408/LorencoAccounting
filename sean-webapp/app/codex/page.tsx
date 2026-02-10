"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const DOMAINS = [
  "VAT",
  "INCOME_TAX",
  "COMPANY_TAX",
  "PAYROLL",
  "CAPITAL_GAINS_TAX",
  "WITHHOLDING_TAX",
  "ACCOUNTING_GENERAL",
  "OTHER",
];

const RULE_TYPES = [
  "allowance",
  "prohibition",
  "limitation",
  "exemption",
  "threshold",
  "requirement",
  "definition",
  "procedure",
];

interface CodexRule {
  section: string;
  type: string;
  law_says: string;
  interpretation: string;
  application_logic: string;
}

interface CodexItem {
  id: string;
  citationId: string;
  title: string;
  contentText: string;
  layer: string;
  status: string;
  kbVersion: number;
  createdAt: string;
  approvedAt?: string;
  primaryDomain: string;
  secondaryDomains: string;
  sourceType?: string;
  sourceUrl?: string;
  submittedBy: { email: string };
}

// Templates for General codex type
const GENERAL_TEMPLATES = {
  vat_cross_reference: {
    name: "VAT Cross-Reference",
    template: {
      vat_cross_reference: {
        principle: "",
        rules: [
          {
            scenario: "",
            vat_act: "",
            income_tax_interaction: "",
            sean_instruction: "",
          },
        ],
      },
    },
  },
  decision_engine: {
    name: "Decision Engine / Role",
    template: {
      role: "Sean AI – [Purpose]",
      mandatory_decision_order: [
        { step: 1, action: "", details: "" },
      ],
      output_requirements: [],
      forbidden_behaviour: [],
    },
  },
  lookup_table: {
    name: "Lookup Table",
    template: {
      lookup_table: {
        name: "",
        description: "",
        entries: [
          { key: "", value: "", notes: "" },
        ],
      },
    },
  },
  custom: {
    name: "Custom JSON",
    template: {},
  },
};

interface EditModalState {
  isOpen: boolean;
  step: "type" | "details" | "rules" | "general";
  item: CodexItem | null;
  codexType: "accounting" | "general" | "coaching" | "";
  // Pack metadata
  codexPack: string;
  jurisdiction: string;
  authority: string;
  // Rules (for accounting)
  rules: CodexRule[];
  // General type
  generalTemplate: keyof typeof GENERAL_TEMPLATES | "";
  generalJson: string;
  // Legacy fields
  title: string;
  contentText: string;
  primaryDomain: string;
  secondaryDomains: string[];
  layer: string;
}

const emptyRule: CodexRule = {
  section: "",
  type: "allowance",
  law_says: "",
  interpretation: "",
  application_logic: "",
};

export default function CodexPage() {
  const [items, setItems] = useState<CodexItem[]>([]);
  const [tab, setTab] = useState<"items" | "ingest" | "pdf">("items");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );
  const [layer, setLayer] = useState<string>("all");
  const [primaryDomain, setPrimaryDomain] = useState<string>("all");
  const [secondaryDomain, setSecondaryDomain] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    step: "type",
    item: null,
    codexType: "",
    codexPack: "",
    jurisdiction: "South Africa",
    authority: "",
    rules: [{ ...emptyRule }],
    generalTemplate: "",
    generalJson: "{}",
    title: "",
    contentText: "",
    primaryDomain: "OTHER",
    secondaryDomains: [],
    layer: "LEGAL",
  });
  const [editSaving, setEditSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/codex/list?status=${status}`;
      if (layer !== "all") {
        url += `&layer=${layer}`;
      }
      if (primaryDomain !== "all") {
        url += `&primaryDomain=${primaryDomain}`;
      }
      if (secondaryDomain !== "all") {
        url += `&secondaryDomain=${secondaryDomain}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  }, [status, layer, primaryDomain, secondaryDomain]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleApprove = async (itemId: string) => {
    try {
      const res = await fetch("/api/codex/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeItemId: itemId }),
      });

      if (res.ok) {
        loadItems();
      }
    } catch (error) {
      console.error("Approve failed:", error);
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      const res = await fetch("/api/codex/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeItemId: itemId }),
      });

      if (res.ok) {
        loadItems();
      }
    } catch (error) {
      console.error("Reject failed:", error);
    }
  };

  // Parse existing content to extract structured data
  const parseExistingContent = (item: CodexItem) => {
    try {
      const parsed = JSON.parse(item.contentText);
      // Check for accounting type (has codex_pack and rules array with section/law_says)
      if (parsed.codex_pack && parsed.rules && parsed.rules[0]?.section) {
        return {
          codexType: "accounting" as const,
          codexPack: parsed.codex_pack || "",
          jurisdiction: parsed.jurisdiction || "South Africa",
          authority: parsed.authority || "",
          rules: parsed.rules || [{ ...emptyRule }],
          generalJson: "",
        };
      }
      // Check for general type (any other valid JSON)
      return {
        codexType: "general" as const,
        codexPack: "",
        jurisdiction: "",
        authority: "",
        rules: [],
        generalJson: item.contentText,
      };
    } catch {
      // Not JSON, treat as coaching/text content
      return {
        codexType: "coaching" as const,
        codexPack: "",
        jurisdiction: "",
        authority: "",
        rules: [],
        generalJson: "",
      };
    }
  };

  const openEditModal = (item: CodexItem) => {
    const parsed = parseExistingContent(item);

    setEditModal({
      isOpen: true,
      step: "type",
      item,
      codexType: parsed?.codexType || "",
      codexPack: parsed?.codexPack || item.title,
      jurisdiction: parsed?.jurisdiction || "South Africa",
      authority: parsed?.authority || "",
      rules: parsed?.rules?.length ? parsed.rules : [{ ...emptyRule }],
      generalTemplate: "",
      generalJson: parsed?.generalJson || "{}",
      title: item.title,
      contentText: item.contentText,
      primaryDomain: item.primaryDomain,
      secondaryDomains: parseSecondaryDomains(item.secondaryDomains),
      layer: item.layer,
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      step: "type",
      item: null,
      codexType: "",
      codexPack: "",
      jurisdiction: "South Africa",
      authority: "",
      rules: [{ ...emptyRule }],
      generalTemplate: "",
      generalJson: "{}",
      title: "",
      contentText: "",
      primaryDomain: "OTHER",
      secondaryDomains: [],
      layer: "LEGAL",
    });
  };

  const openNewCodexModal = () => {
    setEditModal({
      isOpen: true,
      step: "type",
      item: { id: "new", citationId: "", title: "", contentText: "", layer: "LEGAL", status: "PENDING", kbVersion: 1, createdAt: new Date().toISOString(), primaryDomain: "OTHER", secondaryDomains: "[]", submittedBy: { email: "" } } as CodexItem,
      codexType: "",
      codexPack: "",
      jurisdiction: "South Africa",
      authority: "",
      rules: [{ ...emptyRule }],
      generalTemplate: "",
      generalJson: "{}",
      title: "",
      contentText: "",
      primaryDomain: "OTHER",
      secondaryDomains: [],
      layer: "LEGAL",
    });
  };

  const handleEditSave = async () => {
    if (!editModal.item) return;
    setEditSaving(true);

    try {
      let contentText = editModal.contentText;
      let title = editModal.title;

      // Build structured content for accounting type
      if (editModal.codexType === "accounting") {
        const structuredContent = {
          codex_pack: editModal.codexPack,
          jurisdiction: editModal.jurisdiction,
          authority: editModal.authority,
          rules: editModal.rules.filter(r => r.section || r.law_says),
        };
        contentText = JSON.stringify(structuredContent, null, 2);
        title = editModal.codexPack;
      }

      // For general type, use the JSON directly
      if (editModal.codexType === "general") {
        // Validate JSON
        try {
          JSON.parse(editModal.generalJson);
          contentText = editModal.generalJson;
        } catch {
          alert("Invalid JSON format. Please check your content.");
          setEditSaving(false);
          return;
        }
      }

      // Check if this is a new item or an update
      const isNew = editModal.item.id === "new";
      const endpoint = isNew ? "/api/codex/submit" : "/api/codex/update";
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? {} : { id: editModal.item.id }),
          title,
          contentText,
          primaryDomain: editModal.primaryDomain,
          secondaryDomains: editModal.secondaryDomains,
          layer: editModal.layer,
        }),
      });

      if (res.ok) {
        closeEditModal();
        loadItems();
      } else {
        const data = await res.json();
        alert(`Failed to ${isNew ? "create" : "update"}: ${data.error}`);
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save item");
    } finally {
      setEditSaving(false);
    }
  };

  const applyGeneralTemplate = (templateKey: keyof typeof GENERAL_TEMPLATES) => {
    const template = GENERAL_TEMPLATES[templateKey];
    setEditModal(prev => ({
      ...prev,
      generalTemplate: templateKey,
      generalJson: JSON.stringify(template.template, null, 2),
    }));
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(editModal.generalJson);
      setEditModal(prev => ({
        ...prev,
        generalJson: JSON.stringify(parsed, null, 2),
      }));
    } catch {
      alert("Invalid JSON - cannot format");
    }
  };

  const addRule = () => {
    setEditModal(prev => ({
      ...prev,
      rules: [...prev.rules, { ...emptyRule }],
    }));
  };

  const removeRule = (index: number) => {
    setEditModal(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const updateRule = (index: number, field: keyof CodexRule, value: string) => {
    setEditModal(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule
      ),
    }));
  };

  const toggleSecondaryDomain = (domain: string) => {
    setEditModal((prev) => ({
      ...prev,
      secondaryDomains: prev.secondaryDomains.includes(domain)
        ? prev.secondaryDomains.filter((d) => d !== domain)
        : [...prev.secondaryDomains, domain],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "APPROVED":
        return "bg-green-50 border-green-200 text-green-800";
      case "REJECTED":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-slate-50 border-slate-200 text-slate-800";
    }
  };

  const getLayerBadge = (layer: string) => {
    const colors = {
      LEGAL: "bg-purple-100 text-purple-800",
      FIRM: "bg-blue-100 text-blue-800",
      CLIENT: "bg-green-100 text-green-800",
    };
    return colors[layer as keyof typeof colors] || "bg-slate-100 text-slate-800";
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      VAT: "bg-indigo-100 text-indigo-800",
      INCOME_TAX: "bg-cyan-100 text-cyan-800",
      COMPANY_TAX: "bg-sky-100 text-sky-800",
      PAYROLL: "bg-violet-100 text-violet-800",
      CAPITAL_GAINS_TAX: "bg-fuchsia-100 text-fuchsia-800",
      WITHHOLDING_TAX: "bg-pink-100 text-pink-800",
      ACCOUNTING_GENERAL: "bg-orange-100 text-orange-800",
      OTHER: "bg-slate-100 text-slate-800",
    };
    return colors[domain] || "bg-slate-100 text-slate-800";
  };

  const parseSecondaryDomains = (secondaryDomainsJson: string): string[] => {
    try {
      return JSON.parse(secondaryDomainsJson);
    } catch {
      return [];
    }
  };

  const handleIngestWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;

    setIngestLoading(true);
    setIngestMessage("");

    try {
      const res = await fetch("/api/codex/ingest-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: websiteUrl,
          domain: "OTHER",
          layer: "LEGAL",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIngestMessage(`✓ Created ${data.items.length} suggested codex items`);
        setWebsiteUrl("");
        setTimeout(() => {
          setStatus("pending");
          loadItems();
        }, 1000);
      } else {
        setIngestMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      setIngestMessage(`✗ Error: ${error}`);
    } finally {
      setIngestLoading(false);
    }
  };

  const handleIngestPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;

    setPdfLoading(true);
    setPdfMessage("");

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);

      const res = await fetch("/api/codex/ingest-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setPdfMessage(
          `✓ ${data.message} Domain breakdown: ${Object.entries(data.domainCounts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}`
        );
        setPdfFile(null);
        setTimeout(() => {
          setStatus("pending");
          loadItems();
        }, 1000);
      } else {
        setPdfMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      setPdfMessage(`✗ Error: ${error}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // Render the edit modal based on current step
  const renderEditModal = () => {
    if (!editModal.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editModal.item?.id === "new" ? "Teach Sean" : "Edit Codex Item"}
                </h2>
                {editModal.step !== "type" && (
                  <p className="text-sm text-slate-500 mt-1">
                    Type: {editModal.codexType === "accounting" ? "Tax Rules" : editModal.codexType === "general" ? "General" : "Coaching"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                x
              </button>
            </div>

            {/* Step 1: Choose Type */}
            {editModal.step === "type" && (
              <div className="space-y-6">
                <p className="text-slate-700 mb-4">What type of codex is this?</p>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, codexType: "accounting", step: "details" }))}
                    className={`p-6 border-2 rounded-xl text-left transition hover:border-blue-500 hover:bg-blue-50 ${
                      editModal.codexType === "accounting" ? "border-blue-500 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="text-3xl mb-2">📊</div>
                    <h3 className="font-semibold text-slate-900 text-lg">Tax Rules</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Structured tax laws with sections, interpretations, application logic
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, codexType: "general", step: "general" }))}
                    className={`p-6 border-2 rounded-xl text-left transition hover:border-purple-500 hover:bg-purple-50 ${
                      editModal.codexType === "general" ? "border-purple-500 bg-purple-50" : "border-slate-200"
                    }`}
                  >
                    <div className="text-3xl mb-2">🔧</div>
                    <h3 className="font-semibold text-slate-900 text-lg">General</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      VAT cross-refs, decision engines, lookup tables, roles
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, codexType: "coaching", step: "details" }))}
                    className={`p-6 border-2 rounded-xl text-left transition hover:border-green-500 hover:bg-green-50 ${
                      editModal.codexType === "coaching" ? "border-green-500 bg-green-50" : "border-slate-200"
                    }`}
                  >
                    <div className="text-3xl mb-2">🎯</div>
                    <h3 className="font-semibold text-slate-900 text-lg">Coaching</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Business advice, guidelines, procedures (coming soon)
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Details (Accounting) */}
            {editModal.step === "details" && editModal.codexType === "accounting" && (
              <div className="space-y-4">
                {/* Pack Name */}
                <div>
                  <label htmlFor="codex-pack" className="block text-sm font-medium text-slate-700 mb-1">
                    Codex Pack Name
                  </label>
                  <input
                    id="codex-pack"
                    type="text"
                    value={editModal.codexPack}
                    onChange={(e) => setEditModal({ ...editModal, codexPack: e.target.value })}
                    placeholder="SA Income Tax – Deductibility Rules v1.0"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Jurisdiction */}
                <div>
                  <label htmlFor="jurisdiction" className="block text-sm font-medium text-slate-700 mb-1">
                    Jurisdiction
                  </label>
                  <input
                    id="jurisdiction"
                    type="text"
                    value={editModal.jurisdiction}
                    onChange={(e) => setEditModal({ ...editModal, jurisdiction: e.target.value })}
                    placeholder="South Africa"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Authority */}
                <div>
                  <label htmlFor="authority" className="block text-sm font-medium text-slate-700 mb-1">
                    Legal Authority
                  </label>
                  <input
                    id="authority"
                    type="text"
                    value={editModal.authority}
                    onChange={(e) => setEditModal({ ...editModal, authority: e.target.value })}
                    placeholder="Income Tax Act 58 of 1962"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Domain */}
                <div>
                  <label htmlFor="edit-domain" className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Domain
                  </label>
                  <select
                    id="edit-domain"
                    value={editModal.primaryDomain}
                    onChange={(e) => setEditModal({ ...editModal, primaryDomain: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    {DOMAINS.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Secondary Domains */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Secondary Domains
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAINS.filter(d => d !== editModal.primaryDomain).map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => toggleSecondaryDomain(domain)}
                        className={`px-3 py-1 rounded text-sm transition ${
                          editModal.secondaryDomains.includes(domain)
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {domain.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, step: "type" }))}
                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, step: "rules" }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Next: Add Rules
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Details (Coaching) */}
            {editModal.step === "details" && editModal.codexType === "coaching" && (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="edit-title" className="block text-sm font-medium text-slate-700 mb-1">
                    Title
                  </label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editModal.title}
                    onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Content */}
                <div>
                  <label htmlFor="edit-content" className="block text-sm font-medium text-slate-700 mb-1">
                    Content
                  </label>
                  <textarea
                    id="edit-content"
                    value={editModal.contentText}
                    onChange={(e) => setEditModal({ ...editModal, contentText: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-y"
                  />
                </div>

                {/* Layer */}
                <div>
                  <label htmlFor="edit-layer" className="block text-sm font-medium text-slate-700 mb-1">
                    Layer
                  </label>
                  <select
                    id="edit-layer"
                    value={editModal.layer}
                    onChange={(e) => setEditModal({ ...editModal, layer: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="LEGAL">Legal/Regulatory</option>
                    <option value="FIRM">Firm-specific</option>
                    <option value="CLIENT">Client-specific</option>
                  </select>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, step: "type" }))}
                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Rules (Accounting only) */}
            {editModal.step === "rules" && editModal.codexType === "accounting" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-slate-900">Rules</h3>
                  <button
                    type="button"
                    onClick={addRule}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                  >
                    + Add Rule
                  </button>
                </div>

                <div className="space-y-6">
                  {editModal.rules.map((rule, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium text-slate-700">Rule {index + 1}</span>
                        {editModal.rules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRule(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Section
                          </label>
                          <input
                            type="text"
                            value={rule.section}
                            onChange={(e) => updateRule(index, "section", e.target.value)}
                            placeholder="11(a)"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Type
                          </label>
                          <select
                            title="Rule type"
                            value={rule.type}
                            onChange={(e) => updateRule(index, "type", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                          >
                            {RULE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          What the Law Says
                        </label>
                        <textarea
                          value={rule.law_says}
                          onChange={(e) => updateRule(index, "law_says", e.target.value)}
                          rows={3}
                          placeholder="Expenditure and losses actually incurred in the production of income..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-y"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Interpretation
                        </label>
                        <textarea
                          value={rule.interpretation}
                          onChange={(e) => updateRule(index, "interpretation", e.target.value)}
                          rows={3}
                          placeholder="This is the general permission for deductions. An expense must meet all elements..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Application Logic
                        </label>
                        <textarea
                          value={rule.application_logic}
                          onChange={(e) => updateRule(index, "application_logic", e.target.value)}
                          rows={2}
                          placeholder="If all requirements are met, proceed to Section 23 prohibition test."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, step: "details" }))}
                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {editSaving ? "Saving..." : "Save Codex Pack"}
                  </button>
                </div>
              </div>
            )}

            {/* General Type Editor */}
            {editModal.step === "general" && editModal.codexType === "general" && (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="general-title" className="block text-sm font-medium text-slate-700 mb-1">
                    Title
                  </label>
                  <input
                    id="general-title"
                    type="text"
                    value={editModal.title}
                    onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                    placeholder="VAT Cross-Reference Rules"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Templates */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start from Template (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(GENERAL_TEMPLATES).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyGeneralTemplate(key as keyof typeof GENERAL_TEMPLATES)}
                        className={`px-3 py-1 rounded text-sm transition ${
                          editModal.generalTemplate === key
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {value.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="general-domain" className="block text-sm font-medium text-slate-700 mb-1">
                      Primary Domain
                    </label>
                    <select
                      id="general-domain"
                      value={editModal.primaryDomain}
                      onChange={(e) => setEditModal({ ...editModal, primaryDomain: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                      {DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="general-layer" className="block text-sm font-medium text-slate-700 mb-1">
                      Layer
                    </label>
                    <select
                      id="general-layer"
                      value={editModal.layer}
                      onChange={(e) => setEditModal({ ...editModal, layer: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                      <option value="LEGAL">Legal/Regulatory</option>
                      <option value="FIRM">Firm-specific</option>
                      <option value="CLIENT">Client-specific</option>
                    </select>
                  </div>
                </div>

                {/* JSON Editor */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="general-json" className="block text-sm font-medium text-slate-700">
                      Content (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={formatJson}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Format JSON
                    </button>
                  </div>
                  <textarea
                    id="general-json"
                    value={editModal.generalJson}
                    onChange={(e) => setEditModal({ ...editModal, generalJson: e.target.value })}
                    rows={16}
                    placeholder='{"key": "value"}'
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono text-sm resize-y"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter valid JSON. Use templates above for common formats like VAT cross-references, decision engines, etc.
                  </p>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditModal(prev => ({ ...prev, step: "type" }))}
                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {editSaving ? "Saving..." : "Save Codex"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Codex</h1>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => openNewCodexModal()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                + Teach Sean
              </button>
              <Link
                href="/chat"
                className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to Chat
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-300 mb-4">
            <button
              type="button"
              onClick={() => setTab("items")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "items"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Codex Items
            </button>
            <button
              type="button"
              onClick={() => setTab("ingest")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "ingest"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ingest Website
            </button>
            <button
              type="button"
              onClick={() => setTab("pdf")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "pdf"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upload PDF
            </button>
          </div>

          {tab === "ingest" && (
            <form onSubmit={handleIngestWebsite} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.sars.gov.za/..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={ingestLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {ingestLoading ? "Ingesting..." : "Ingest"}
                </button>
              </div>
              {ingestMessage && (
                <p className={`mt-2 text-sm ${ingestMessage.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {ingestMessage}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Allowed: sars.gov.za only. Content will be suggested as PENDING codex.
              </p>
            </form>
          )}

          {tab === "pdf" && (
            <form onSubmit={handleIngestPdf} className="mb-6">
              <div className="flex gap-2">
                <label title="Select PDF file" className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="text-slate-600">
                    {pdfFile ? pdfFile.name : "Click to select PDF file..."}
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={pdfLoading || !pdfFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? "Processing..." : "Upload"}
                </button>
              </div>
              {pdfMessage && (
                <p className={`mt-2 text-sm ${pdfMessage.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {pdfMessage}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Max 15MB. PDFs are split into chunks. All items created as PENDING and require approval.
              </p>
            </form>
          )}

          {tab === "items" && (
          <>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                title="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "approved" | "rejected" | "all")}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Layer
              </label>
              <select
                title="Filter by layer"
                value={layer}
                onChange={(e) => setLayer(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Layers</option>
                <option value="LEGAL">Legal/Regulatory</option>
                <option value="FIRM">Firm-specific</option>
                <option value="CLIENT">Client-specific</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Primary Domain
              </label>
              <select
                title="Filter by primary domain"
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Domains</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Secondary Domain
              </label>
              <select
                title="Filter by secondary domain"
                value={secondaryDomain}
                onChange={(e) => setSecondaryDomain(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Domains</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {tab === "items" && (
        <>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No codex items found for the selected filters.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 ${getStatusColor(item.status)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLayerBadge(item.layer)}`}>
                        {item.layer}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDomainColor(item.primaryDomain)}`}>
                        {item.primaryDomain.replace(/_/g, " ")}
                      </span>
                      <code className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                        {item.citationId}
                      </code>
                    </div>

                    {/* Secondary domains if any */}
                    {parseSecondaryDomains(item.secondaryDomains).length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {parseSecondaryDomains(item.secondaryDomains).map((domain) => (
                          <span
                            key={domain}
                            className={`px-2 py-0.5 rounded text-xs font-medium opacity-75 ${getDomainColor(domain)}`}
                          >
                            {domain.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>

                    {/* Content Preview */}
                    {item.contentText && (
                      <details className="mb-3">
                        <summary className="text-sm font-medium cursor-pointer hover:text-blue-600 transition">
                          View Content ({item.contentText.length} chars)
                        </summary>
                        <div className="mt-2 p-3 bg-white bg-opacity-50 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {item.contentText}
                        </div>
                      </details>
                    )}

                    <p className="text-sm opacity-75 mb-2">
                      Submitted by {item.submittedBy.email}
                      {" on "}
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.sourceType && (
                        <span className="ml-2">
                          · Source: {item.sourceType}
                          {item.sourceUrl && (
                            <span className="text-xs ml-1">({item.sourceUrl.substring(0, 40)}...)</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4 flex-col">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                    >
                      Edit
                    </button>
                    {item.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(item.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(item.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Version info */}
                <div className="text-xs opacity-75 mt-2">
                  Version {item.kbVersion}
                  {item.approvedAt && (
                    <span>
                      {" · "}
                      Approved {new Date(item.approvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Edit Modal */}
      {renderEditModal()}
    </div>
  );
}
