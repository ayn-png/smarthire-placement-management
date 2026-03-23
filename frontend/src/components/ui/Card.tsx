"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  glass?: boolean;
  hover?: boolean;
}

export default function Card({ children, className, title, subtitle, glass, hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : {}}
      className={cn(
        "rounded-2xl p-6 transition-all duration-300",
        glass
          ? "glass-card"
          : "bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-premium hover:shadow-premium-hover",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-5">
          {title && (
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </motion.div>
  );
}
