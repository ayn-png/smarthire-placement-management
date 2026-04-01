"use client";
import { useState, useEffect } from "react";
import { AlertCircle, Clock, CheckCircle2, ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { complaintsService } from "@/services/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";

export default function StudentComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const data = await complaintsService.list();
      setComplaints(data);
    } catch (err) {
      toast.error("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      await complaintsService.create(form);
      toast.success("Complaint submitted successfully");
      setForm({ title: "", description: "" });
      setShowForm(false);
      fetchComplaints();
    } catch (err) {
      toast.error("Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <FadeIn className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-glow-sm">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Help & Support</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Raise issues or track your previous complaints</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
          {showForm ? "View Issues" : <><PlusCircle className="w-4 h-4" /> Raise Issue</>}
        </Button>
      </FadeIn>

      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="max-w-2xl mx-auto border-primary-500/30 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">New Issue</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Subject</label>
                  <Input 
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Brief title of the issue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
                  <textarea 
                    className="w-full h-40 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none text-sm"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe your issue in detail so management can assist you better..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Complaint"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            {complaints.length === 0 ? (
              <div className="text-center py-16 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-200 dark:border-surface-700/50">
                <AlertCircle className="w-12 h-12 text-surface-400 mx-auto mb-3 opacity-50" />
                <p className="text-surface-500 dark:text-surface-400 font-medium">You haven't raised any issues</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>Raise Your First Issue</Button>
              </div>
            ) : (
              <StaggerContainer>
                {complaints.map((comp) => (
                  <StaggerItem key={comp.id}>
                    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm transition-all hover:border-primary-500/30">
                      <div 
                        className="p-4 sm:p-5 flex justify-between items-center cursor-pointer select-none"
                        onClick={() => setExpandedId(expandedId === comp.id ? null : comp.id)}
                      >
                        <div className="flex-1 pr-4">
                          <h3 className="font-semibold text-surface-900 dark:text-white text-base truncate">{comp.title}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 dark:text-surface-400">
                             <span>{new Date(comp.created_at).toLocaleDateString()}</span>
                             <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600"></span>
                             {comp.status === "Pending" ? (
                               <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-medium"><Clock className="w-3.5 h-3.5" /> Pending</span>
                             ) : (
                               <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Resolved</span>
                             )}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-700 flex justify-center items-center text-surface-500 transition-transform">
                          {expandedId === comp.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedId === comp.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-surface-50 dark:bg-surface-900/50 border-t border-surface-100 dark:border-surface-800"
                          >
                            <div className="p-4 sm:p-5 space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-surface-400 mb-1 uppercase tracking-wider">Description</h4>
                                <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{comp.description}</p>
                              </div>
                              
                              {comp.status === "Resolved" && comp.solution && (
                                <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl relative overflow-hidden">
                                   <div className="absolute top-0 right-0 p-3 opacity-20"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></div>
                                   <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mb-2 flex items-center gap-1">
                                     <CheckCircle2 className="w-3.5 h-3.5" /> RESOLUTION
                                   </h4>
                                   <p className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap relative z-10">{comp.solution}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
