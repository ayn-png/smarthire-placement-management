"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search, Globe, Mail, MapPin, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { companyService } from "@/services/api";
import { Company } from "@/types";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { extractErrorMsg } from "@/lib/utils";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    name: "", industry: "", description: "", website: "",
    location: "", contact_email: "", contact_person: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await companyService.list({ limit: 50 });
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
    } catch {
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingCompany(null);
    setForm({ name: "", industry: "", description: "", website: "", location: "", contact_email: "", contact_person: "" });
    setShowModal(true);
  }

  function openEdit(company: Company) {
    setEditingCompany(company);
    setForm({
      name: company.name, industry: company.industry, description: company.description || "",
      website: company.website || "", location: company.location, contact_email: company.contact_email,
      contact_person: company.contact_person || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.industry || !form.location || !form.contact_email) {
      alert("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      if (editingCompany) {
        await companyService.update(editingCompany.id, form);
      } else {
        await companyService.create(form);
      }
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      alert(extractErrorMsg(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await companyService.delete(id);
      await load();
    } catch {
      alert("Failed to delete company");
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const blob = await companyService.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "companies_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Companies</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{total} registered companies</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="secondary" disabled={exporting}>
              <Download className="w-4 h-4" />{exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button onClick={openCreate} variant="gradient"><Plus className="w-4 h-4" />Add Company</Button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-surface-400 dark:text-surface-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
          />
        </div>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((company) => (
          <StaggerItem key={company.id}>
            <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 hover:shadow-premium transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-white text-sm">{company.name}</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{company.industry}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(company)} className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(company.id, company.name)} className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                  <MapPin className="w-3 h-3" />{company.location}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                  <Mail className="w-3 h-3" />{company.contact_email}
                </div>
                {company.website && (
                  <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400">
                    <Globe className="w-3 h-3" />
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                      {company.website}
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </StaggerItem>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-surface-400 dark:text-surface-500" />
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No companies found</p>
          </div>
        )}
      </StaggerContainer>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-lg shadow-premium"
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">{editingCompany ? "Edit Company" : "Add Company"}</h2>
                <button onClick={() => setShowModal(false)} className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 text-2xl leading-none transition-colors">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Company Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" />
                  <Input label="Industry *" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Technology" />
                  <Input label="Location *" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bangalore" />
                  <Input label="Contact Email *" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                  <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                  <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleSave} loading={saving} variant="gradient">
                  {editingCompany ? "Save Changes" : "Add Company"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
