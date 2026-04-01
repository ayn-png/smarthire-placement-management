"use client";
import { useState, useEffect } from "react";
import { BellRing, Send } from "lucide-react";
import { motion } from "framer-motion";
import { announcementsService } from "@/services/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { toast } from "react-hot-toast";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", target_audience: "STUDENTS" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await announcementsService.list();
      setAnnouncements(data);
    } catch (err) {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.message) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      await announcementsService.create(form);
      toast.success("Announcement broadcasted successfully!");
      setForm({ title: "", message: "", target_audience: "STUDENTS" });
      fetchAnnouncements();
    } catch (err) {
      toast.error("Failed to send announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-glow-sm">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Announcements</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Broadcast important updates to students and placement admins.</p>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FadeIn delay={0.1} className="lg:col-span-1">
          <Card className="sticky top-6">
            <h2 className="text-lg font-semibold mb-4 text-surface-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-primary-500" /> New Broadcast
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Target Audience</label>
                <select 
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all mt-1"
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                >
                  <option value="STUDENTS">Students</option>
                  <option value="PLACEMENT_ADMINS">Placement Admins</option>
                  <option value="ALL">Everyone</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Title</label>
                <Input 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  placeholder="e.g., Upcoming Google Drive" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Message</label>
                <textarea 
                  className="w-full h-32 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Enter the comprehensive details of the announcement..."
                />
              </div>
              <Button type="submit" className="w-full flex justify-center items-center gap-2" disabled={submitting}>
                {submitting ? "Broadcasting..." : "Broadcast Announcement"}
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </Card>
        </FadeIn>

        <StaggerContainer className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">Previous Announcements</h2>
          {loading ? (
             <div className="animate-pulse space-y-4">
               {[1, 2, 3].map((i) => (
                 <div key={i} className="h-24 bg-surface-100 dark:bg-surface-800 rounded-xl"></div>
               ))}
             </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-200 dark:border-surface-700/50">
              <BellRing className="w-12 h-12 text-surface-400 mx-auto mb-3 opacity-50" />
              <p className="text-surface-500 dark:text-surface-400 font-medium">No announcements yet</p>
            </div>
          ) : (
            announcements.map((ann) => (
              <StaggerItem key={ann.id}>
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-base font-semibold text-surface-900 dark:text-white">{ann.title}</h3>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400">
                      {ann.target_audience}
                    </span>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-300 mt-2 whitespace-pre-wrap">{ann.message}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-surface-400 dark:text-surface-500">
                    <span>By {ann.created_by_name || 'Management'}</span>
                    <span>{new Date(ann.created_at).toLocaleString()}</span>
                  </div>
                </motion.div>
              </StaggerItem>
            ))
          )}
        </StaggerContainer>
      </div>
    </div>
  );
}
