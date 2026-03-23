import Link from "next/link";
import { GraduationCap, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-violet-900 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-6 ring-1 ring-white/20">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-black text-white/10 leading-none select-none mb-2">404</h1>

        <h2 className="text-2xl font-bold text-white mb-3">Page not found</h2>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-primary-700 font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors shadow-lg"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold text-sm rounded-xl hover:bg-white/20 transition-colors ring-1 ring-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>

        <p className="text-white/20 text-xs mt-8">SmartHire Placement Portal</p>
      </div>
    </div>
  );
}
