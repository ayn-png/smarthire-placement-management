"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Briefcase,
  BarChart3,
  Users,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Button from "@/components/ui/Button";

const features = [
  {
    icon: Briefcase,
    title: "Job Listings",
    description: "Browse curated placement opportunities from top recruiters.",
  },
  {
    icon: Users,
    title: "Smart Applications",
    description: "Track every application from submission to final offer.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Real-time placement statistics for students and management.",
  },
  {
    icon: Sparkles,
    title: "AI Interview Prep",
    description: "Practice with AI-powered mock interviews before the real thing.",
  },
];

const stats = [
  { value: "500+", label: "Companies" },
  { value: "10k+", label: "Students Placed" },
  { value: "95%", label: "Placement Rate" },
  { value: "50+", label: "Campuses" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-surface-950 to-primary-900" />
        <motion.div
          animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -20, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl"
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">SmartHire</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="gradient" size="sm">
                Get Started
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-sm mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            College Placement Management System
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Your Career Journey
            <br />
            <span className="bg-gradient-to-r from-primary-400 via-purple-400 to-primary-300 bg-clip-text text-transparent">
              Starts Here
            </span>
          </h1>

          <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
            SmartHire connects students, placement cells, and college management on one
            intelligent platform — from job discovery to final placement.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button variant="gradient" size="lg">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold">Everything You Need</h2>
          <p className="mt-3 text-white/50 max-w-xl mx-auto">
            A complete toolkit for modern campus placements.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/5 hover:border-primary-500/20 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-white/5 backdrop-blur-md rounded-3xl p-10 md:p-14 border border-white/5"
        >
          <h2 className="text-3xl font-bold text-center mb-10">Built for Every Role</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                role: "Students",
                items: ["Browse & apply to jobs", "Upload resume", "AI interview prep", "Track applications"],
              },
              {
                role: "Placement Admins",
                items: ["Manage companies & jobs", "Schedule interviews", "Approve applications", "Generate reports"],
              },
              {
                role: "College Management",
                items: ["Placement analytics", "Department-wise stats", "Trend analysis", "Export reports"],
              },
            ].map((block) => (
              <div key={block.role}>
                <h3 className="text-lg font-semibold mb-4 text-primary-300">{block.role}</h3>
                <ul className="space-y-3">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-white/50 max-w-lg mx-auto mb-8">
            Join SmartHire and streamline your campus placement process today.
          </p>
          <Link href="/signup">
            <Button variant="gradient" size="lg">
              Create Your Account
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>SmartHire &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
