"use client";
import { useEffect, useState } from "react";
import { Settings2, Save, KeyRound, UserCircle } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import api from "@/lib/axios";
import { extractErrorMsg } from "@/lib/utils";
import { adminProfileService } from "@/services/api";

interface SystemSettings {
  notify_new_jobs_email?: boolean;
  notification_batch_limit?: number;
}

interface AdminProfileForm {
  full_name: string;
  phone: string;
  designation: string;
  college_name: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  // Admin profile state
  const [profileForm, setProfileForm] = useState<AdminProfileForm>({ full_name: "", phone: "", designation: "", college_name: "" });
  const [profileExists, setProfileExists] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password reset state
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/v1/settings/");
        setSettings(data ?? {});
      } catch {
        setSettings({});
      } finally {
        setLoading(false);
      }
    })();
    // Load admin profile
    adminProfileService.get()
      .then((res: { data?: AdminProfileForm & { id?: string } }) => {
        if (res?.data) {
          setProfileForm({
            full_name: res.data.full_name ?? "",
            phone: res.data.phone ?? "",
            designation: res.data.designation ?? "",
            college_name: res.data.college_name ?? "",
          });
          setProfileExists(true);
        }
      })
      .catch(() => setProfileExists(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch("/api/v1/settings/", settings);
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileMsg("");
    try {
      if (profileExists) {
        await adminProfileService.update(profileForm);
      } else {
        await adminProfileService.create({ ...profileForm, email: user?.email ?? "" });
        setProfileExists(true);
      }
      setProfileMsg("Profile saved successfully!");
      setTimeout(() => setProfileMsg(""), 3000);
    } catch (err) {
      setProfileError(extractErrorMsg(err, "Failed to save profile"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendPasswordReset() {
    setSendingReset(true);
    setResetMsg("");
    try {
      const email = user?.email;
      if (!email) throw new Error("No email found for your account.");
      await sendPasswordResetEmail(auth, email);
      setResetMsg(`Password reset email sent to ${email}. Check your inbox.`);
    } catch {
      setResetMsg("Failed to send reset email. Please try again.");
    } finally {
      setSendingReset(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-64" size="lg" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">System Settings</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">Configure SmartHire portal settings</p>
          </div>
        </div>
      </FadeIn>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-emerald-700 dark:text-emerald-400 text-sm">{successMsg}</div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {/* Admin Profile */}
      <FadeIn delay={0.05}>
        <form onSubmit={handleProfileSave}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <UserCircle className="w-4 h-4 text-surface-500 dark:text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">Admin Profile</h3>
            </div>
            {profileMsg && <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-emerald-700 dark:text-emerald-400 text-sm">{profileMsg}</div>}
            {profileError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-red-700 dark:text-red-400 text-sm">{profileError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Full Name *</label>
                <input
                  type="text" value={profileForm.full_name} required
                  onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Phone</label>
                <input
                  type="tel" value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="10-digit phone number"
                  className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Designation</label>
                <input
                  type="text" value={profileForm.designation}
                  onChange={(e) => setProfileForm((p) => ({ ...p, designation: e.target.value }))}
                  placeholder="e.g. Placement Officer"
                  className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">College Name</label>
                <input
                  type="text" value={profileForm.college_name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, college_name: e.target.value }))}
                  placeholder="e.g. ABC Engineering College"
                  className="w-full px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" loading={profileSaving}>
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </div>
          </div>
        </form>
      </FadeIn>

      {/* Account Security — separate card, no form submit */}
      <FadeIn delay={0.1}>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-surface-500 dark:text-surface-400" />
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">Account Security</h3>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Change Password</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                A password reset link will be sent to your registered email address.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={handleSendPasswordReset} loading={sendingReset}>
              Send Reset Email
            </Button>
          </div>
          {resetMsg && (
            <p className={`mt-3 text-sm ${resetMsg.startsWith("Failed") ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {resetMsg}
            </p>
          )}
        </div>
      </FadeIn>

      <form onSubmit={handleSave}>
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Email for new jobs</p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">Send email to students when new jobs are posted</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.notify_new_jobs_email ?? false}
                      onChange={(e) => setSettings((s) => ({ ...s, notify_new_jobs_email: e.target.checked }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-surface-200 peer-focus:ring-2 peer-focus:ring-primary-500 dark:bg-surface-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Notification Batch Limit</label>
                  <input type="number" min={1} max={10000} value={settings.notification_batch_limit ?? 500}
                    onChange={(e) => setSettings((s) => ({ ...s, notification_batch_limit: parseInt(e.target.value) || 500 }))}
                    className="w-40 px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Max students notified per new job posting</p>
                </div>
              </div>
            </div>

            <div className="border-t border-surface-200 dark:border-surface-700 pt-4 flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                <Save className="w-4 h-4" /> Save Settings
              </Button>
            </div>
          </div>
        </FadeIn>
      </form>
    </div>
  );
}
