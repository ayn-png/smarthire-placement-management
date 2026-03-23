import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}

const variants = {
  default: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 ring-1 ring-emerald-200/50 dark:ring-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 ring-1 ring-amber-200/50 dark:ring-amber-500/20",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 ring-1 ring-red-200/50 dark:ring-red-500/20",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 ring-1 ring-blue-200/50 dark:ring-blue-500/20",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 ring-1 ring-purple-200/50 dark:ring-purple-500/20",
};

export default function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
