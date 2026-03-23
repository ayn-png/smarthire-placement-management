"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ElementType;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon: Icon, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-surface-600 dark:text-surface-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icon className="w-4 h-4 text-surface-400 dark:text-surface-500" />
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "w-full px-3.5 py-2.5 border rounded-xl text-sm transition-all duration-200",
              "bg-white dark:bg-surface-900 placeholder:text-surface-400 dark:placeholder:text-surface-500",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:ring-primary-400/20 dark:focus:border-primary-400",
              error
                ? "border-red-400 bg-red-50/50 dark:bg-red-950/20 dark:border-red-500"
                : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600",
              "text-surface-900 dark:text-surface-100",
              Icon && "pl-9",
              className
            )}
            {...props}
          />
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-1.5 text-xs text-red-500 dark:text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
