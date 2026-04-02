"use client";
import { useState, useEffect } from "react";
import { Trophy, Medal, Star, Target, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { leaderboardService } from "@/services/api";
import Card from "@/components/ui/Card";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const data = await leaderboardService.get({ limit: 50 });
      setLeaderboard(data);
    } catch (err) {
      toast.error("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner className="h-[60vh]" size="lg" />;

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-glow-sm shadow-yellow-500/30 mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">SmartHire Leaderboard</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-2 text-sm">Top performing students based on academic excellence, placement readiness, and mock interview scores.</p>
        </div>
      </FadeIn>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <FadeIn delay={0.2} className="flex justify-center items-end gap-4 sm:gap-6 mb-12 h-64">
          {/* 2nd Place */}
          {topThree[1] && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="flex flex-col items-center w-28 sm:w-36"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-surface-200 to-surface-300 dark:from-surface-700 dark:to-surface-800 flex items-center justify-center border-4 border-surface-100 dark:border-surface-900 shadow-xl z-20">
                  <span className="text-xl font-bold text-surface-600 dark:text-surface-300">{topThree[1].name?.charAt(0)}</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-full flex items-center justify-center border border-white dark:border-surface-900 shadow-md">
                   <Medal className="w-4 h-4 text-slate-500" />
                </div>
              </div>
              <div className="text-center w-full z-10 bg-white/50 dark:bg-surface-800/50 backdrop-blur-md border border-surface-200 dark:border-surface-700 rounded-t-2xl pt-4 pb-12 flex flex-col items-center">
                <h3 className="font-bold text-sm text-surface-900 dark:text-white line-clamp-1 px-2">{topThree[1].name}</h3>
                <p className="text-xs text-surface-500">{topThree[1].department}</p>
                <div className="mt-2 text-primary-600 dark:text-primary-400 font-bold">{topThree[1].total_score} pts</div>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {topThree[0] && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="flex flex-col items-center w-32 sm:w-44 z-10 -m-4"
            >
              <div className="relative mb-3 -mt-8">
                <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-yellow-500 drop-shadow-md z-30 animate-pulse" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center border-4 border-white dark:border-surface-900 shadow-2xl shadow-yellow-500/20 z-20 relative">
                  <span className="text-3xl font-bold text-white shadow-sm">{topThree[0].name?.charAt(0)}</span>
                </div>
              </div>
              <div className="text-center w-full z-10 bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-surface-800 border border-yellow-200 dark:border-yellow-700/50 rounded-t-2xl pt-6 pb-16 flex flex-col items-center shadow-[0_-10px_40px_-15px_rgba(234,179,8,0.3)]">
                <h3 className="font-black text-base text-surface-900 dark:text-white line-clamp-1 px-2">{topThree[0].name}</h3>
                <p className="text-xs text-surface-500 font-medium">{topThree[0].department}</p>
                <div className="mt-3 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full text-sm font-black border border-yellow-200 dark:border-yellow-700/50">
                  {topThree[0].total_score} pts
                </div>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {topThree[2] && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="flex flex-col items-center w-28 sm:w-36"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center border-4 border-white dark:border-surface-900 shadow-xl z-20">
                  <span className="text-xl font-bold text-amber-100">{topThree[2].name?.charAt(0)}</span>
                </div>
                <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center border border-white dark:border-surface-900 shadow-md">
                   <Medal className="w-4 h-4 text-amber-200" />
                </div>
              </div>
              <div className="text-center w-full z-10 bg-white/50 dark:bg-surface-800/50 backdrop-blur-md border border-surface-200 dark:border-surface-700 rounded-t-2xl pt-4 pb-8 flex flex-col items-center">
                <h3 className="font-bold text-sm text-surface-900 dark:text-white line-clamp-1 px-2">{topThree[2].name}</h3>
                <p className="text-xs text-surface-500">{topThree[2].department}</p>
                <div className="mt-2 text-primary-600 dark:text-primary-400 font-bold">{topThree[2].total_score} pts</div>
              </div>
            </motion.div>
          )}
        </FadeIn>
      )}

      {/* Rest of Leaderboard */}
      <FadeIn delay={1.0}>
        <Card className="px-5 py-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="py-3 text-left w-12 text-surface-400">Rank</th>
                  <th className="py-3 text-left font-medium text-surface-500 uppercase tracking-wider text-xs">Student Name</th>
                  <th className="py-3 text-left font-medium text-surface-500 uppercase tracking-wider text-xs">Department</th>
                  <th className="py-3 text-right font-medium text-surface-500 uppercase tracking-wider text-xs">CGPA</th>
                  <th className="py-3 text-right font-medium text-surface-500 uppercase tracking-wider text-xs">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                <StaggerContainer>
                  {rest.map((student, idx) => (
                    <StaggerItem key={student.id}>
                      <motion.tr 
                        whileHover={{ backgroundColor: "rgba(99, 102, 241, 0.03)" }}
                        className="group"
                      >
                        <td className="py-4 font-bold text-surface-400 text-center">#{idx + 4}</td>
                        <td className="py-4 font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs ring-1 ring-primary-500/20">
                             {student.name?.charAt(0)}
                           </div>
                           {student.name}
                        </td>
                        <td className="py-4 text-surface-600 dark:text-surface-400">{student.department || "N/A"}</td>
                        <td className="py-4 text-right text-surface-600 dark:text-surface-400">{student.cgpa || 0}</td>
                        <td className="py-4 text-right font-bold text-primary-600 dark:text-primary-400">{student.total_score}</td>
                      </motion.tr>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </tbody>
            </table>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
