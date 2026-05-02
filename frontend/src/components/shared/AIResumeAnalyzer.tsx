"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  Target,
  AlertTriangle,
  Lightbulb,
  Code2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  ThumbsUp,
  ThumbsDown,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { aiResumeService } from "@/services/api";
import { ResumeAnalysis } from "@/types";
import { extractErrorMsg } from "@/lib/utils";

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 75
      ? "text-emerald-500"
      : score >= 50
      ? "text-amber-500"
      : "text-red-500";
  const bgRing =
    score >= 75
      ? "stroke-emerald-100 dark:stroke-emerald-950/40"
      : score >= 50
      ? "stroke-amber-100 dark:stroke-amber-950/40"
      : "stroke-red-100 dark:stroke-red-950/40";
  const fgRing =
    score >= 75
      ? "stroke-emerald-500"
      : score >= 50
      ? "stroke-amber-500"
      : "stroke-red-500";

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className={bgRing} />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={fgRing}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-3xl font-bold ${color}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">ATS Score</span>
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</span>
          {badge && (
            <Badge variant="info" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-surface-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-surface-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIResumeAnalyzer({ hasResume }: { hasResume: boolean }) {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [showJdInput, setShowJdInput] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const result = await aiResumeService.analyzeResume(
        jobDesc.trim() ? { job_description: jobDesc.trim() } : undefined
      );
      setAnalysis(result);
    } catch (err: unknown) {
      setError(extractErrorMsg(err, "Analysis failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  if (!hasResume) return null;

  return (
    <div className="space-y-4">
      {/* Trigger button area */}
      {!analysis && !loading && (
        <Card hover={false}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center shadow-sm">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-surface-800 dark:text-surface-200 text-sm">
                  ATS Resume Insights
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Get ATS score, skill gaps, strengths &amp; improvement tips
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJdInput(!showJdInput)}
                className="text-xs"
              >
                {showJdInput ? "Hide" : "Add"} Job Description
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={handleAnalyze}
                className="whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run ATS Analysis
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showJdInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <textarea
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="Paste a job description here for targeted analysis (optional)..."
                  rows={4}
                  className="mt-4 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-4 py-3 text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card hover={false}>
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-primary-500/20 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl bg-primary-500/10"
                  />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-surface-800 dark:text-surface-200 text-sm">
                    Analyzing your resume...
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                    AI is reviewing your resume for ATS compatibility
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Header + ATS Score ring */}
            <Card hover={false}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center">
                    <FileSearch className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-surface-800 dark:text-surface-200">
                    Analysis Results
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAnalysis(null);
                    setError("");
                  }}
                  className="text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </Button>
              </div>

              <ScoreRing score={analysis.atsScore ?? 0} />

              <p className="text-center text-xs text-surface-500 dark:text-surface-400 mt-3">
                {(analysis.atsScore ?? 0) >= 75
                  ? "Great! Your resume is well-optimized for ATS."
                  : (analysis.atsScore ?? 0) >= 50
                  ? "Decent score. A few improvements can boost it."
                  : "Needs work. Follow the suggestions below."}
              </p>
            </Card>

            {/* Skills Found */}
            {(analysis.extractedSkills?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={Code2}
                  title="Skills Found"
                  badge={`${analysis.extractedSkills?.length ?? 0}`}
                >
                  <div className="flex flex-wrap gap-2">
                    {analysis.extractedSkills?.map((skill) => (
                      <Badge key={skill} variant="purple">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </Section>
              </Card>
            )}

            {/* Strengths — new section */}
            {(analysis.strengths?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={ThumbsUp}
                  title="Strengths"
                  badge={`${analysis.strengths?.length ?? 0}`}
                >
                  <ul className="space-y-2.5">
                    {analysis.strengths?.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-surface-700 dark:text-surface-300"
                      >
                        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </Card>
            )}

            {/* Weaknesses — new section */}
            {(analysis.weaknesses?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={ThumbsDown}
                  title="Weaknesses"
                  badge={`${analysis.weaknesses?.length ?? 0}`}
                  defaultOpen={false}
                >
                  <ul className="space-y-2.5">
                    {analysis.weaknesses?.map((w, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-surface-700 dark:text-surface-300"
                      >
                        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center text-[10px] font-bold">
                          !
                        </span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </Card>
            )}

            {/* Missing Skills */}
            {(analysis.missingSkills?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={Target}
                  title="Missing Skills"
                  badge={`${analysis.missingSkills?.length ?? 0}`}
                >
                  <div className="flex flex-wrap gap-2">
                    {analysis.missingSkills?.map((skill) => (
                      <Badge key={skill} variant="warning">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </Section>
              </Card>
            )}

            {/* Improvement Suggestions */}
            {(analysis.suggestions?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={Lightbulb}
                  title="Improvement Suggestions"
                  badge={`${analysis.suggestions?.length ?? 0}`}
                >
                  <ul className="space-y-2.5">
                    {analysis.suggestions?.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-surface-700 dark:text-surface-300"
                      >
                        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </Card>
            )}

            {/* Job Suggestions - NEW! */}
            {(analysis.jobSuggestions?.length ?? 0) > 0 && (
              <Card hover={false}>
                <Section
                  icon={Briefcase}
                  title="Recommended Job Roles"
                  badge={`${analysis.jobSuggestions?.length ?? 0}`}
                >
                  <div className="space-y-3">
                    {analysis.jobSuggestions?.map((job, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-950/20 dark:to-violet-950/20 border border-primary-100 dark:border-primary-900/30"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-sm">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="font-semibold text-surface-800 dark:text-surface-200 text-sm">
                              {job.role}
                            </h4>
                            <Badge variant="success" className="text-[10px] font-bold">
                              {job.matchScore} Match
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {job.requiredSkills.slice(0, 6).map((skill, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50"
                              >
                                {skill}
                              </span>
                            ))}
                            {job.requiredSkills.length > 6 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-surface-500 dark:text-surface-400">
                                +{job.requiredSkills.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </Card>
            )}

            {/* Re-analyze button */}
            <div className="flex justify-center pt-2">
              <Button variant="secondary" size="sm" onClick={handleAnalyze}>
                <Sparkles className="w-3.5 h-3.5" />
                Re-analyze
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
