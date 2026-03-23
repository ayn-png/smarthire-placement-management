"use client";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "purple" | "orange" | "red";
}

const colorMap = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-100 dark:ring-blue-900/50",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-100 dark:ring-emerald-900/50",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
    ring: "ring-purple-100 dark:ring-purple-900/50",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    icon: "text-orange-600 dark:text-orange-400",
    value: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-100 dark:ring-orange-900/50",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
    ring: "ring-red-100 dark:ring-red-900/50",
  },
};

export default function StatsCard({ title, value, icon: Icon, trend, color = "blue" }: StatsCardProps) {
  const colors = colorMap[color];
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 shadow-premium hover:shadow-premium-hover transition-all duration-300"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{title}</p>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn("text-3xl font-bold tracking-tight", colors.value)}
          >
            {value}
          </motion.p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium mt-2 flex items-center gap-1",
                trend.value >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              <span className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]",
                trend.value >= 0
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-red-100 dark:bg-red-900/40"
              )}>
                {trend.value >= 0 ? "↑" : "↓"}
              </span>
              {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            "p-3.5 rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110",
            colors.bg,
            colors.ring
          )}
        >
          <Icon className={cn("w-6 h-6", colors.icon)} />
        </div>
      </div>
    </motion.div>
  );
}
