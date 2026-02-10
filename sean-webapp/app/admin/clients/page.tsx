"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  industryId?: string;
  industry?: { id: string; code: string; name: string };
  businessType?: string;
  dataIsolationLevel: string;
  _count?: {
    allocationRules: number;
    bankTransactions: number;
    customCategories: number;
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", code: "", description: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients?stats=true&industry=true");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add client");
      }

      setShowAddModal(false);
      setNewClient({ name: "", code: "", description: "" });
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add client");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Company Management</h1>
            <p className="text-gray-500">Manage client companies and their profiles</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Company
          </button>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.code}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${client.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {client.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {client.industry && (
                <div className="mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {client.industry.name}
                  </span>
                </div>
              )}

              {client.businessType && (
                <p className="text-sm text-gray-600 mb-2">{client.businessType}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500 mt-4">
                <span>{client._count?.bankTransactions || 0} transactions</span>
                <span>{client._count?.allocationRules || 0} rules</span>
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                <span className={`${client.dataIsolationLevel === "STRICT" ? "text-red-600" : "text-green-600"}`}>
                  {client.dataIsolationLevel === "STRICT" ? "Strict Privacy" : "Industry Learning"}
                </span>
                <span className="text-blue-600">Edit Profile &rarr;</span>
              </div>
            </Link>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No companies yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add your first company
            </button>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Company</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>
              )}

              <form onSubmit={handleAddClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Code *</label>
                  <input
                    type="text"
                    value={newClient.code}
                    onChange={(e) => setNewClient({ ...newClient, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., ABC001"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newClient.description}
                    onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {adding ? "Adding..." : "Add Company"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
