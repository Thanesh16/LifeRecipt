import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  Package,
  FileText,
  Globe,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Clock,
  ShieldCheck,
  Building,
} from 'lucide-react';
import assistantService from '../services/assistantService';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

const STARTER_PROMPTS = [
  'Which of my products have expired warranty?',
  'Which products are currently under warranty?',
  'How much have I spent on all my products?',
  'What is my most expensive product?',
  'Show products purchased this year',
  'Where can I claim warranty for my laptop in Chennai?',
];

export const AssistantPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('lifereceipt_assistant_session') || `session_${Date.now()}`;
  });

  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation history on mount
  useEffect(() => {
    localStorage.setItem('lifereceipt_assistant_session', sessionId);
    const loadHistory = async () => {
      try {
        const res = await assistantService.getHistory(sessionId);
        if (res.success && res.data?.messages?.length > 0) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        console.error('[Assistant History Error]', err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadHistory();
  }, [sessionId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend = null) => {
    const query = textToSend || inputQuery;
    if (!query || !query.trim() || loading) return;

    const userText = query.trim();
    setInputQuery('');

    // Append user message immediately
    const userMsg = {
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await assistantService.sendMessage(userText, sessionId);
      if (res.success && res.data) {
        const assistantMsg = {
          role: 'assistant',
          content: res.data.response,
          productContext: res.data.productContext,
          sources: res.data.sources || [],
          conflicts: res.data.conflicts || [],
          webSearched: res.data.webSearched,
          retrievalDate: res.data.retrievalDate,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content:
          err.response?.data?.message ||
          'I encountered an error retrieving your ownership records. Please try again.',
        sources: [],
        conflicts: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Clear conversation history and start a fresh session?')) return;
    try {
      await assistantService.clearHistory(sessionId);
    } catch (err) {
      console.warn('[Clear Session Warning]', err);
    }
    const newSession = `session_${Date.now()}`;
    setSessionId(newSession);
    localStorage.setItem('lifereceipt_assistant_session', newSession);
    setMessages([]);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                AI Ownership Assistant
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Sparkles className="w-2.5 h-2.5" /> Web Grounded
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ask anything about your products, warranties, receipts, and authorized service centers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleClearChat}
            >
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {initialLoading ? (
          <div className="py-20 text-center">
            <LoadingSpinner size="lg" label="Initializing assistant session..." />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center max-w-xl mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                How can I assist your ownership today?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                I can look up warranty deadlines from your verified receipts, identify service center numbers from your documents, or find official manufacturer support centers in your city.
              </p>
            </div>

            {/* Starter Prompt Pills */}
            <div className="max-w-2xl mx-auto space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Suggested Questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 text-left rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 hover:bg-slate-850 text-xs text-slate-300 transition-all flex items-start gap-2.5"
                  >
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-br-xs shadow-sm font-medium'
                      : 'bg-slate-900 border border-slate-800 rounded-bl-xs text-slate-200'
                  }`}
                >
                  {/* Assistant Header: Product Context Badge */}
                  {!isUser && msg.productContext && (
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-800">
                      <Package className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-slate-400 font-medium">Context:</span>
                      {msg.productContext.productId ? (
                        <Link
                          to={`/products/${msg.productContext.productId}`}
                          className="font-semibold text-sky-400 hover:underline"
                        >
                          {msg.productContext.brand ? `${msg.productContext.brand} ` : ''}
                          {msg.productContext.productName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-200">
                          {msg.productContext.productName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-2 break-words">
                    {msg.content}
                  </div>

                  {/* Discrepancy / Conflict Alert if present */}
                  {!isUser && msg.conflicts && msg.conflicts.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-[11px] text-amber-300">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Source Discrepancy Identified</span>
                      </div>
                      {msg.conflicts.map((c, cIdx) => (
                        <div key={cIdx} className="space-y-0.5">
                          <p className="font-medium text-amber-200">{c.field}:</p>
                          <p className="text-[10px] text-amber-300/90">
                            • Document says: <strong>{c.documentValue}</strong>
                          </p>
                          <p className="text-[10px] text-amber-300/90">
                            • Web portal says: <strong>{c.webValue}</strong>
                          </p>
                          <p className="text-[10px] italic text-amber-400/90 mt-0.5">
                            {c.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grounded Sources Section */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Information Sources ({msg.sources.length})</span>
                        {msg.webSearched && msg.retrievalDate && (
                          <span className="flex items-center gap-1 text-emerald-400 font-normal normal-case">
                            <Clock className="w-3 h-3" />
                            Checked online: {msg.retrievalDate}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, sIdx) => {
                          const isOfficial = src.type === 'WEB_OFFICIAL';
                          const isDoc = src.type === 'DOCUMENT';
                          const isDb = src.type === 'DATABASE';
                          const isGov = src.type === 'WEB_GOVERNMENT';

                          return (
                            <div
                              key={sIdx}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                                isDb
                                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-300'
                                  : isDoc
                                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                                  : isOfficial
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                  : isGov
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                              }`}
                            >
                              {isDb && <Package className="w-3 h-3 text-sky-400 shrink-0" />}
                              {isDoc && <FileText className="w-3 h-3 text-violet-400 shrink-0" />}
                              {(isOfficial || isGov) && (
                                <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                              )}
                              {!isDb && !isDoc && !isOfficial && !isGov && (
                                <Building className="w-3 h-3 text-amber-400 shrink-0" />
                              )}

                              <span className="truncate max-w-[200px]">{src.title}</span>

                              {src.url && (
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:text-sky-300 ml-1"
                                  title="Open official web source"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Analyzing ownership ledger, documents, and official support directories...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-800 pt-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask about your warranties, receipts, return periods, or service centers..."
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <Button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            size="md"
            className="px-5 shrink-0"
          >
            <Send className="w-4 h-4 mr-1.5" />
            <span>Ask</span>
          </Button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2">
          Strictly grounded in your authenticated LifeReceipt records & official manufacturer support portals.
        </p>
      </div>
    </div>
  );
};

export default AssistantPage;
