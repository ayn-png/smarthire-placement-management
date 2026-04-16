"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { marketJobsService } from "@/services/api";

interface MarketJobApplyModalProps {
  jobId: string;
  onClose: () => void;
}

export default function MarketJobApplyModal({ jobId, onClose }: MarketJobApplyModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to close and clear tracking state
  const handleDismiss = () => {
    localStorage.removeItem("market_job_clicked");
    onClose();
  };

  async function handleApplied() {
    setLoading(true);
    setError(null);
    try {
      await marketJobsService.markApplied({ job_id: jobId });
      setSuccess(true);
      setTimeout(() => {
        handleDismiss();
      }, 1500);
    } catch (err) {
      setError("Failed to record application. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-md shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden"
      >
        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white">Applied!</h3>
            <p className="text-surface-500 dark:text-surface-400">Your application has been tracked successfully.</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-surface-900 dark:text-white">Did you apply?</h3>
              <button 
                onClick={handleDismiss}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-surface-400" />
              </button>
            </div>
            
            <p className="text-surface-600 dark:text-surface-400">
              We noticed you clicked on an external job link. Did you complete the application on the external site?
            </p>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="secondary" 
                fullWidth 
                onClick={handleDismiss}
                disabled={loading}
              >
                No, not yet
              </Button>
              <Button 
                variant="gradient" 
                fullWidth 
                onClick={handleApplied}
                loading={loading}
              >
                Yes, I applied
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
