"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, fullWidth, children, disabled, ...props }, ref) => {
    const variants = {
      primary:
        "bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md dark:bg-primary-500 dark:hover:bg-primary-600",
      secondary:
        "bg-white hover:bg-surface-50 text-surface-700 border border-surface-200 hover:border-surface-300 shadow-sm dark:bg-surface-800 dark:text-surface-200 dark:border-surface-700 dark:hover:bg-surface-700",
      danger:
        "bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md dark:bg-red-500 dark:hover:bg-red-600",
      ghost:
        "hover:bg-surface-100 text-surface-600 dark:text-surface-300 dark:hover:bg-surface-800",
      gradient:
        "btn-gradient",
    };
    const sizes = {
      sm: "text-xs px-3 py-1.5 rounded-lg",
      md: "text-sm px-4 py-2.5 rounded-xl",
      lg: "text-sm px-6 py-3 rounded-xl",
    };

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileHover={disabled || loading ? {} : { scale: 1.01, y: -1 }}
        whileTap={disabled || loading ? {} : { scale: 0.98 }}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ripple",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
export default Button;
