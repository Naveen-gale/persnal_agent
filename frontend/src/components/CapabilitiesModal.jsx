import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { Cpu, X, CheckCircle, Mail, Users, Shield, Image } from 'lucide-react';

export function CapabilitiesModal({ isOpen, onClose }) {
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getCapabilities()
        .then((caps) => setCapabilities(caps))
        .catch(() => setCapabilities(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
              <Cpu className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Agent Capabilities</h2>
              <p className="text-xs text-zinc-400">Architecture & Active LangGraph Tools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
              <span>Querying Python Agent runtime...</span>
            </div>
          ) : capabilities ? (
            <div className="space-y-4">
              {/* Meta stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                    LLM Provider
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 truncate">
                    Groq High-Speed API
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                    Active Model
                  </span>
                  <span className="text-xs font-mono font-medium text-zinc-200 truncate" title={capabilities.model || 'openai/gpt-oss-120b'}>
                    {capabilities.model || 'openai/gpt-oss-120b'}
                  </span>
                </div>
              </div>

              {/* Gmail tools */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <span>Gmail & Email Dispatch Tools</span>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">send_email:</strong> Compose and dispatch real emails directly via Gmail API to any recipient.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">natural_language_understanding:</strong> Understand casual conversational prompts without rigid command keywords.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">list_recent_emails:</strong> Fetch latest inbox messages with sender, subject, and snippet preview.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">search_emails:</strong> Targeted search across sender, subject, date, and query keywords.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">summarize_emails_with_ai:</strong> Context-aware executive email summarizer.</span>
                  </div>
                </div>
              </div>

              {/* Contacts tools */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>Google Contacts Tools</span>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">search_contacts:</strong> Find phone numbers, emails, and address notes by person name.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">list_contacts:</strong> Browse synced contacts saved in your MongoDB and Google account.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">add_contact:</strong> Create and save new contacts directly to your Google account.</span>
                  </div>
                </div>
              </div>

              {/* Photos & ImageKit */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <Image className="w-4 h-4 text-zinc-400" />
                  <span>Google Photos & ImageKit CDN</span>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">auto_sync_to_imagekit:</strong> Automatically streams user photos into private ImageKit CDN with MongoDB metadata indexing.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-zinc-200 font-medium">list_photos:</strong> Browse, preview, inspect in high-resolution lightbox, and share CDN URLs with the AI agent.</span>
                  </div>
                </div>
              </div>

              {/* Security info */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
                <Shield className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Thread-safe <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px]">contextvars</code> credential injection ensures high security and stateless cloud deployments without local OS keychain dependencies.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-xs text-red-300">
              Could not fetch runtime agent capabilities. Ensure the Python agent service is running on <code className="font-mono text-red-200">http://127.0.0.1:8000</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
