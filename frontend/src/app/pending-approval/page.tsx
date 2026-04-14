"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, GraduationCap, ChevronLeft } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg bg-surface-900/50 backdrop-blur-xl border border-surface-800 p-8 md:p-12 rounded-3xl shadow-2xl text-center relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-primary-600/20 rounded-2xl flex items-center justify-center ring-1 ring-primary-500/50">
            <Clock className="w-10 h-10 text-primary-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
          Account Pending Approval
        </h1>
        
        <p className="text-surface-400 text-lg leading-relaxed mb-8">
          Your admin account has been created successfully. For security reasons, 
          it must be verified and activated by the system administrator before
          you can access the dashboard.
        </p>

        <div className="bg-surface-800/50 rounded-2xl p-6 mb-8 border border-surface-700/50">
          <p className="text-sm text-surface-300">
            Typically, this process takes 1-2 business days. You will receive an 
            email confirmation once your account has been approved.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-white bg-primary-600 hover:bg-primary-500 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-primary-900/20"
          >
            Return to Login
          </Link>
          
          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-surface-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </motion.div>

      <div className="mt-12 flex items-center gap-2 text-surface-500 relative z-10">
        <GraduationCap className="w-5 h-5" />
        <span className="font-bold text-sm tracking-wider uppercase">SmartHire Portal</span>
      </div>
    </div>
  );
}
