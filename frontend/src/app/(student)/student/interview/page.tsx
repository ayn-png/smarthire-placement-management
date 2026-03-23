"use client";
import { useState, useRef, useEffect } from "react";
import { Brain, Send, RefreshCw, ChevronDown, ChevronUp, MessageSquare, Sparkles, Zap, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { interviewService } from "@/services/api";
import { InterviewQuestion } from "@/types";
import { FadeIn } from "@/components/ui/Animations";

type InterviewType = "TECHNICAL" | "HR" | "MANAGERIAL" | "CASE_STUDY"; // Feature 5
type Difficulty = "easy" | "medium" | "hard";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  feedback?: string;
}

export default function InterviewPage() {
  const [activeTab, setActiveTab] = useState<"questions" | "mock">("questions");
  const [interviewType, setInterviewType] = useState<InterviewType>("TECHNICAL");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  // Mock chat
  const CHAT_STORAGE_KEY = "smarthire_interview_chat";
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Restore chat history from localStorage on first render
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist chat history to localStorage whenever it changes
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable (e.g. private mode with storage blocked) — ignore
    }
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadQuestions() {
    setLoadingQ(true);
    try {
      const data = await interviewService.getQuestions({
        interview_type: interviewType,
        difficulty,
        count: 10,
      });
      setQuestions(data.questions || []);
      setExpandedQ(null);
    } catch {
      alert("Failed to load questions");
    } finally {
      setLoadingQ(false);
    }
  }

  async function startMockInterview() {
    setMessages([]); // clears localStorage via the effect above
    setChatLoading(true);
    try {
      const data = await interviewService.mockChat({ messages: [] });
      setMessages([{ role: "assistant", content: data.reply }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setChatLoading(true);
    try {
      const data = await interviewService.mockChat({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        interview_type: interviewType,
        difficulty,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, feedback: data.feedback || undefined }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 md:p-8 text-white shadow-glow-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span className="text-purple-200 text-xs font-medium uppercase tracking-wider">AI-Powered</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Interview Preparation</h1>
              <p className="text-purple-100 mt-0.5 text-sm">Practice with AI-generated questions and mock interviews</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.1}>
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl w-fit">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab("questions")}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "questions"
                ? "bg-white dark:bg-surface-700 shadow-sm text-primary-700 dark:text-primary-400"
                : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            <Zap className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Question Bank
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab("mock")}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "mock"
                ? "bg-white dark:bg-surface-700 shadow-sm text-primary-700 dark:text-primary-400"
                : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            <Bot className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Mock Interview
          </motion.button>
        </div>
      </FadeIn>

      {activeTab === "questions" && (
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Interview Type</label>
                  <select
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                    className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                  >
                    <option value="TECHNICAL">Technical</option>
                    <option value="HR">HR</option>
                    <option value="MANAGERIAL">Managerial</option>
                    <option value="CASE_STUDY">Case Study</option>  {/* Feature 5 */}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <Button onClick={loadQuestions} loading={loadingQ} variant="gradient">
                  <Brain className="w-4 h-4" />
                  Generate Questions
                </Button>
                {questions.length > 0 && (
                  <Button variant="secondary" onClick={loadQuestions} loading={loadingQ}>
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                )}
              </div>
            </Card>

            {questions.length > 0 ? (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <button
                      onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-5 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-surface-800 dark:text-surface-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{q.question}</span>
                      </div>
                      <motion.div animate={{ rotate: expandedQ === idx ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4 text-surface-400 dark:text-surface-500 flex-shrink-0" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {expandedQ === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-3 border-t border-surface-100 dark:border-surface-700 pt-4">
                            {q.hint && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">💡 Hint</p>
                                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{q.hint}</p>
                              </div>
                            )}
                            {q.sample_answer && (
                              <div className="bg-primary-50 dark:bg-primary-950/20 rounded-xl p-4 border border-primary-100 dark:border-primary-900/30">
                                <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 mb-1">📝 Sample Answer</p>
                                <p className="text-sm text-primary-800 dark:text-primary-300 leading-relaxed">{q.sample_answer}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">Select interview type and click Generate Questions</p>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {activeTab === "mock" && (
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-white">AI Mock Interviewer</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Practice real interview conversations with instant feedback</p>
                  </div>
                </div>
                <Button onClick={startMockInterview} variant={messages.length > 0 ? "secondary" : "gradient"}>
                  {messages.length > 0 ? "Restart Interview" : "Start Interview"}
                </Button>
              </div>
            </Card>

            {messages.length > 0 && (
              <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 flex flex-col shadow-sm" style={{ height: "500px" }}>
                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1.5 ml-1">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <Bot className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-surface-400 dark:text-surface-500 font-medium">AI Interviewer</span>
                          </div>
                        )}
                        <div className={`px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl rounded-br-md shadow-sm"
                            : "bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-2xl rounded-bl-md"
                        }`}>
                          {msg.content}
                        </div>
                        {msg.feedback && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
                          >
                            <span className="font-semibold">Feedback: </span>{msg.feedback}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-700 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-surface-500 dark:text-surface-400">
                        <motion.div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-primary-400 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                            />
                          ))}
                        </motion.div>
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Input */}
                <div className="p-4 border-t border-surface-100 dark:border-surface-700">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Type your answer..."
                      className="flex-1 px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
                      disabled={chatLoading}
                    />
                    <Button onClick={sendMessage} loading={chatLoading} disabled={!input.trim()} variant="gradient">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">Click &quot;Start Interview&quot; to begin your mock interview session</p>
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
