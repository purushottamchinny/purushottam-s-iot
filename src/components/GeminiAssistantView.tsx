import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { apiFetch } from '../api';

interface GeminiAssistantViewProps {
  isGeminiEnabled: boolean;
}

export const GeminiAssistantView: React.FC<GeminiAssistantViewProps> = ({
  isGeminiEnabled,
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      role: 'assistant',
      text: 'Hello, I am your Smart Home Security Assistant. I can summarize presence activity, provide visit counts, and explain security alerts based strictly on your local database records. How can I help you today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly'>('daily');
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [copied, setCopied] = useState(false);

  const presetQuestions = [
    'How many unknown visitors were observed today?',
    'Summarize this week\'s access activity',
    'Are there any pending unreviewed security alerts?',
    'Explain the 3-state access verification rules',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim() || isLoading) return;

    const userMsg = {
      role: 'user' as const,
      text: q.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await apiFetch<{ answer: string }>('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.trim() }),
      });

      const assistantMsg = {
        role: 'assistant' as const,
        text: res.data?.answer || 'No answer returned from system.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Service request error: ${err.message || 'Unable to connect to assistant route.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setGeneratedReport(null);
    try {
      const res = await apiFetch<{ report: string }>(`/api/reports/summary?period=${reportPeriod}`);
      if (res.ok && res.data?.report) {
        setGeneratedReport(res.data.report);
      } else {
        setGeneratedReport('Failed to generate report.');
      }
    } catch (err: any) {
      setGeneratedReport(`Error generating report: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (generatedReport) {
      navigator.clipboard.writeText(generatedReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <span>Security AI Assistant & Activity Reports</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Natural language security intelligence powered by Google Gemini (free tier) and grounded in local database presence metrics.
        </p>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-purple-200">
            Privacy & Grounding Protection:
          </p>
          <p className="text-[11px] text-purple-300/80">
            Assistant answers queries using local database summaries. Images of authorized residents are strictly NEVER transmitted off-device.
            Gemini is never used for real-time per-frame recognition.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chat Assistant (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl bg-slate-900/80 border border-slate-800 h-[560px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-200">Security Assistant</h3>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Grounded in Local DB
                </span>
              </div>
            </div>

            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              {isGeminiEnabled ? 'Gemini 3.8 Flash' : 'Local Fallback'}
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">{m.time}</span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs w-fit">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span>Consulting local database metrics...</span>
              </div>
            )}
          </div>

          {/* Preset Questions Chips */}
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {presetQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700/60 transition-colors shrink-0 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask questions about visitor trends, alerts, or presence counts..."
              className="flex-1 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Right Column: Executive Summary Report Generator (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col h-[560px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Executive Security Report</span>
            </h3>

            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setReportPeriod('daily')}
                className={`px-2.5 py-1 rounded font-medium ${
                  reportPeriod === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setReportPeriod('weekly')}
                className={`px-2.5 py-1 rounded font-medium ${
                  reportPeriod === 'weekly' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 mb-4 transition-all disabled:opacity-50"
          >
            {isGeneratingReport ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span>Aggregating Stats & Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Generate {reportPeriod === 'daily' ? '24-Hour' : '7-Day'} Summary</span>
              </>
            )}
          </button>

          {/* Report Display Container */}
          <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800/80 p-4 overflow-y-auto text-xs leading-relaxed text-slate-300 font-mono relative">
            {generatedReport ? (
              <div>
                <button
                  onClick={handleCopyReport}
                  className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <div className="whitespace-pre-wrap pr-16">{generatedReport}</div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <FileText className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-xs">No report generated yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click &quot;Generate Summary&quot; to synthesize presence metrics into an executive briefing.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
