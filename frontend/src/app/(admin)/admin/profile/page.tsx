"use client";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Phone, Building2, Briefcase, Camera, Save, Loader2, Mail } from "lucide-react";
import api from "@/lib/axios";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  full_name: z.string().min(2, "Full name required"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  college_name: z.string().min(2, "College name required"),
  designation: z.string().min(2, "Designation required"),
});
type FormData = z.infer<typeof schema>;

export default function AdminProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get("/api/v1/admin-profile/me");
      setProfile(res.data);
      reset({
        full_name: res.data.full_name ?? "",
        phone: res.data.phone ?? "",
        college_name: res.data.college_name ?? "",
        designation: res.data.designation ?? "",
      });
    } catch {
      // Profile doesn't exist yet
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (profile) {
        const res = await api.put("/api/v1/admin-profile/me", data);
        setProfile(res.data);
      } else {
        const res = await api.post("/api/v1/admin-profile/", data);
        setProfile(res.data);
      }
      setSuccess("Profile saved successfully!");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/api/v1/admin-profile/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((p: any) => ({ ...p, avatar_url: res.data.avatar_url }));
    } catch {
      setError("Avatar upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Profile</h1>
        <p className="text-gray-500 dark:text-white/50 text-sm mt-1">Manage your placement admin profile</p>
      </div>

      {/* Avatar section */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-5">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-400">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ?? "A"}
                </span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center hover:bg-primary-700 transition-colors"
            >
              {avatarUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-gray-900 dark:text-white font-semibold">{profile?.full_name ?? "Your Name"}</p>
            <p className="text-gray-500 dark:text-white/50 text-sm">{profile?.email ?? ""}</p>
            <p className="text-gray-400 dark:text-white/40 text-xs mt-0.5">{profile?.designation ?? "Placement Admin"}</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-gray-200 dark:border-white/10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Profile Details</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Full Name</label>
              <Input
                type="text"
                placeholder="Your full name"
                {...register("full_name")}
                icon={User}
                error={errors.full_name?.message}
              />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Phone Number</label>
              <Input
                type="text"
                placeholder="10-digit phone"
                {...register("phone")}
                icon={Phone}
                error={errors.phone?.message}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">College / Institution</label>
            <Input
              type="text"
              placeholder="e.g. BITS Pilani"
              {...register("college_name")}
              icon={Building2}
              error={errors.college_name?.message}
            />
          </div>
          <div>
            <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Designation</label>
            <Input
              type="text"
              placeholder="e.g. Placement Officer"
              {...register("designation")}
              icon={Briefcase}
              error={errors.designation?.message}
            />
          </div>
          <div>
            <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">
              Email Address <span className="text-xs text-gray-400 dark:text-white/30">(read-only)</span>
            </label>
            <Input
              type="email"
              value={profile?.email ?? user?.email ?? ""}
              readOnly
              disabled
              icon={Mail}
              className="opacity-70 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Email cannot be changed here</p>
          </div>

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" loading={saving} fullWidth={false}>
            <Save className="w-4 h-4 mr-2" />
            {profile ? "Save Changes" : "Create Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
