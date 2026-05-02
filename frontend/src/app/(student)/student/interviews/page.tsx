"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, ExternalLink, Video,
  MapPin, Briefcase, Link2, CheckCircle, AlertCircle, LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import { calendarService } from "@/services/api";
import { InterviewScheduleItem } from "@/types";
import { extractErrorMsg } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function parseLocalDate(iso: string): Date {
  // Parse YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS as local date to avoid timezone shifts
  const clean = iso.split("T")[0];
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [googleMsg, setGoogleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addingEvent, setAddingEvent] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    Promise.all([
      calendarService.getMyInterviews().then(setInterviews).catch(() => {}),
      calendarService.getGoogleStatus().then(setGoogleStatus).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Build a set of "YYYY-MM-DD" strings for interviews
  const interviewDays = useMemo(() => {
    const set = new Set<string>();
    interviews.forEach((i) => {
      if (i.interview_date) {
        set.add(i.interview_date.split("T")[0]);
      }
    });
    return set;
  }, [interviews]);

  // Calendar grid for current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const selectedInterviews = useMemo(() => {
    if (!selectedDay) return [];
    const key = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`;
    return interviews.filter((i) => i.interview_date?.startsWith(key));
  }, [selectedDay, interviews]);

  async function handleConnectGoogle() {
    try {
      const res = await calendarService.getGoogleAuthUrl();
      window.location.href = res.auth_url;
    } catch (err) {
      setGoogleMsg({ type: "error", text: extractErrorMsg(err, "Failed to get Google auth URL") });
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await calendarService.disconnectGoogle();
      setGoogleStatus(s => s ? { ...s, connected: false } : null);
      setGoogleMsg({ type: "success", text: "Google Calendar disconnected." });
    } catch (err) {
      setGoogleMsg({ type: "error", text: extractErrorMsg(err, "Failed to disconnect") });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleAddToCalendar(applicationId: string) {
    setAddingEvent(applicationId);
    setGoogleMsg(null);
    try {
      const res = await calendarService.addGoogleEvent(applicationId);
      setGoogleMsg({ type: "success", text: "Event added to Google Calendar!" });
      if (res.event_url) window.open(res.event_url, "_blank");
    } catch (err) {
      setGoogleMsg({ type: "error", text: extractErrorMsg(err, "Failed to add event") });
    } finally {
      setAddingEvent(null);
    }
  }

  const INTERVIEW_TYPE_LABELS: Record<string, string> = {
    IN_PERSON: "In Person",
    VIRTUAL: "Virtual",
    PHONE: "Phone",
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Interview Calendar</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
                {interviews.length} scheduled interview{interviews.length !== 1 ? "s" : ""}
              </p>
              <p className="text-surface-400 dark:text-surface-500 text-xs mt-1">
                Interview dates appear here after a placement admin schedules them. Connecting Google Calendar does not auto-add events; use &quot;Add to Calendar&quot; for each interview.
              </p>
            </div>
          </div>

          {/* Google Calendar connect/disconnect */}
          <div className="flex items-center gap-2">
            {googleStatus?.configured && (
              googleStatus.connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Google Calendar connected
                  </span>
                  <Button variant="secondary" onClick={handleDisconnect} loading={disconnecting} className="text-xs h-8 px-3">
                    <LogOut className="w-3 h-3 mr-1" /> Disconnect
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={handleConnectGoogle} className="text-xs h-8 px-3">
                  <Link2 className="w-3 h-3 mr-1" /> Connect Google Calendar
                </Button>
              )
            )}
          </div>
        </div>
      </FadeIn>

      {/* Google message */}
      <AnimatePresence>
        {googleMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
              googleMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
            }`}
          >
            {googleMsg.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {googleMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Calendar grid */}
        <FadeIn delay={0.1} className="lg:col-span-3">
          <Card>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                <ChevronLeft className="w-4 h-4 text-surface-500" />
              </button>
              <h2 className="text-base font-bold text-surface-900 dark:text-white">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                <ChevronRight className="w-4 h-4 text-surface-500" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-surface-400 dark:text-surface-500 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                const hasInterview = interviewDays.has(key);
                const isToday = day.toDateString() === today.toDateString();
                const isSelected = selectedDay?.toDateString() === day.toDateString();
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`relative flex flex-col items-center justify-start p-1.5 rounded-xl text-sm font-medium transition-all h-10 ${
                      isSelected
                        ? "bg-primary-600 text-white shadow-sm"
                        : isToday
                        ? "bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400"
                        : "hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
                    }`}
                  >
                    {day.getDate()}
                    {hasInterview && (
                      <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </FadeIn>

        {/* Interview detail panel */}
        <FadeIn delay={0.15} className="lg:col-span-2">
          {selectedDay ? (
            selectedInterviews.length > 0 ? (
              <div className="space-y-3">
                {selectedInterviews.map((interview) => (
                  <Card key={interview.id}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-white text-sm">{interview.job_title || "Interview"}</p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">{interview.company_name}</p>
                        </div>
                        {interview.interview_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium flex-shrink-0">
                            {INTERVIEW_TYPE_LABELS[interview.interview_type] || interview.interview_type}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary-500" />
                          <span>{interview.interview_date}</span>
                        </div>
                        {interview.interview_link && (
                          <div className="flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-emerald-500" />
                            <a href={interview.interview_link} target="_blank" rel="noopener noreferrer"
                              className="text-primary-600 dark:text-primary-400 hover:underline truncate">
                              Join Interview
                            </a>
                          </div>
                        )}
                        {interview.interview_location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{interview.interview_location}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {interview.interview_link && (
                          <a href={interview.interview_link} target="_blank" rel="noopener noreferrer">
                            <Button variant="primary" className="text-xs h-8 px-3">
                              <ExternalLink className="w-3 h-3 mr-1" /> Join
                            </Button>
                          </a>
                        )}
                        {googleStatus?.connected && (
                          <Button
                            variant="secondary"
                            className="text-xs h-8 px-3"
                            loading={addingEvent === interview.id}
                            onClick={() => handleAddToCalendar(interview.id)}
                          >
                            <Briefcase className="w-3 h-3 mr-1" /> Add to Calendar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <div className="text-center py-10">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-surface-300 dark:text-surface-600" />
                  <p className="text-surface-500 dark:text-surface-400 text-sm">No interviews on this day</p>
                </div>
              </Card>
            )
          ) : (
            <Card>
              <div className="text-center py-10">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-surface-300 dark:text-surface-600" />
                <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">Select a date</p>
                <p className="text-surface-400 dark:text-surface-500 text-xs mt-1">Highlighted dates have scheduled interviews</p>
              </div>
            </Card>
          )}
        </FadeIn>
      </div>

      {/* All upcoming interviews list */}
      {interviews.length > 0 && (
        <FadeIn delay={0.2}>
          <Card title="All Scheduled Interviews">
            <div className="space-y-3">
              {interviews.map((interview) => (
                <motion.div
                  key={interview.id}
                  whileHover={{ x: 2 }}
                  className="flex items-center justify-between gap-3 p-3 bg-surface-50 dark:bg-surface-700/50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{interview.job_title}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{interview.company_name} · {interview.interview_date}</p>
                  </div>
                  {interview.interview_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex-shrink-0">
                      {INTERVIEW_TYPE_LABELS[interview.interview_type] || interview.interview_type}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      {interviews.length === 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
              <p className="text-surface-500 dark:text-surface-400 font-medium">No interviews scheduled</p>
              <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">
                Your interviews will appear here after a placement admin sets an interview date.
              </p>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
