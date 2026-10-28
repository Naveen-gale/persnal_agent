import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Mail, Users, CheckCircle2, Cpu, PlusCircle, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';
import { ComposeEmailModal } from './ComposeEmailModal.jsx';
import { PhotosGalleryModal } from './PhotosGalleryModal.jsx';

export function ChatInterface({
  conversation,
  messages,
  onSendMessage,
  loading,
  onToggleSidebar,
  onOpenGoogleModal,
  onOpenCapabilitiesModal,
}) {
  const [inputText, setInputText] = useState('');
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const { googleStatus } = useAuth();
  const isGoogleConnected = !!(googleStatus && googleStatus.connected);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    const msg = inputText.trim();
    setInputText('');
    onSendMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (prompt) => {
    onSendMessage(prompt);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 min-w-0 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-3 sm:px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 md:hidden transition"
            title="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-medium text-zinc-200 truncate">
              {conversation ? conversation.title : 'New Session'}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Sparkles size={10} className="text-zinc-400" />
              <span>NLU Active</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Compose Email Action */}
          <button
            onClick={() => setIsComposeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition shadow-sm"
            title="Compose and send an email via Gmail"
          >
            <Mail size={13} className="text-zinc-400" />
            <span className="hidden md:inline">Compose Email</span>
          </button>

          {/* Google Photos & ImageKit Action */}
          <button
            onClick={() => setIsPhotosModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition shadow-sm"
            title="View Google Photos stored in ImageKit"
          >
            <ImageIcon size={13} className="text-zinc-400" />
            <span className="hidden md:inline">Photos & CDN</span>
          </button>

          {/* Capabilities Modal */}
          <button
            onClick={onOpenCapabilitiesModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="View Agent Capabilities & Tools"
          >
            <Cpu size={13} />
            <span className="hidden lg:inline">Tools</span>
          </button>

          {/* Google Integration Status */}
          <button
            onClick={onOpenGoogleModal}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              isGoogleConnected
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800/80'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isGoogleConnected ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
            <span className="hidden sm:inline">
              {isGoogleConnected ? 'Google Connected' : 'Connect Google'}
            </span>
          </button>
        </div>
      </header>

      {/* Message History Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 ? (
            <div className="py-8 sm:py-12 text-center max-w-xl mx-auto">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-300">
                <Bot size={20} />
              </div>
              <h2 className="text-base font-semibold text-zinc-200 tracking-tight">Personal AI Agent Ready</h2>
              <p className="text-xs text-zinc-400 mt-1.5 mb-7 leading-relaxed">
                Ask questions, dispatch real Gmail messages, look up contacts, or browse your backed up Google Photos. Natural human language is supported without rigid keywords.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                <button
                  onClick={() => handleSuggestion("Send an email to alex@example.com saying let's sync tomorrow at 3pm")}
                  className="p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={13} className="text-zinc-400 group-hover:text-zinc-200 transition" />
                    <span className="text-xs font-medium text-zinc-200">Send Gmail</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 truncate">
                    "Send email to alex@example.com..."
                  </p>
                </button>

                <button
                  onClick={() => handleSuggestion('Summarize my recent unread emails and highlight any action items')}
                  className="p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={13} className="text-zinc-400 group-hover:text-zinc-200 transition" />
                    <span className="text-xs font-medium text-zinc-200">Summarize Inbox</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 truncate">
                    "Summarize unread emails and highlights"
                  </p>
                </button>

                <button
                  onClick={() => handleSuggestion('Look up Naveen in my contacts and show his phone and email')}
                  className="p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={13} className="text-zinc-400 group-hover:text-zinc-200 transition" />
                    <span className="text-xs font-medium text-zinc-200">Find Contact</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 truncate">
                    "Look up Naveen in my contacts"
                  </p>
                </button>

                <button
                  onClick={() => handleSuggestion('Add a new contact named Maria with phone 9876543210 and email maria@gmail.com')}
                  className="p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PlusCircle size={13} className="text-zinc-400 group-hover:text-zinc-200 transition" />
                    <span className="text-xs font-medium text-zinc-200">Add Contact</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 truncate">
                    "Add contact Maria with phone and email"
                  </p>
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={index}
                  className={`flex gap-3 items-start ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                      <Bot size={15} />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2.5 max-w-xl text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-zinc-800 border border-zinc-700/80 text-zinc-100 font-normal rounded-tr-sm shadow-sm'
                        : 'bg-zinc-900/90 border border-zinc-800/80 text-zinc-200 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <MarkdownRenderer content={msg.text} isUser={isUser} />
                    {msg.createdAt && (
                      <div
                        className={`text-[10px] mt-1.5 text-right font-mono ${
                          isUser ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shrink-0 mt-0.5 text-zinc-200">
                      <User size={15} />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex gap-3 items-start justify-start">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                <Bot size={15} />
              </div>
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-zinc-400" />
                <span>Agent is reasoning and orchestrating tools...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Composer Area */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Quick Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
            <button
              type="button"
              onClick={() => setIsComposeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 shrink-0 transition"
            >
              <Mail size={11} className="text-zinc-400" />
              <span>Compose Email</span>
            </button>
            <button
              type="button"
              onClick={() => handleSuggestion('Show my recent emails from my inbox')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 shrink-0 transition"
            >
              <Mail size={11} className="text-zinc-400" />
              <span>Latest Emails</span>
            </button>
            <button
              type="button"
              onClick={() => handleSuggestion('Show all my contacts')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 shrink-0 transition"
            >
              <Users size={11} className="text-zinc-400" />
              <span>Contacts</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPhotosModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 shrink-0 transition"
            >
              <ImageIcon size={11} className="text-zinc-400" />
              <span>Photos (ImageKit)</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="relative flex items-center">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or command tools: 'send email to...', 'show contacts', 'find photos'..."
              rows={1}
              disabled={loading}
              className="w-full pl-3.5 pr-11 py-2.5 text-xs sm:text-sm bg-zinc-900/90 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-none transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="absolute right-2 p-1.5 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white active:scale-95 disabled:opacity-30 disabled:hover:bg-zinc-100 disabled:cursor-not-allowed transition shadow-sm"
              title="Send message"
            >
              <Send size={14} />
            </button>
          </form>

          <p className="text-[10px] text-center text-zinc-600 font-mono">
            Personal AI Agent · LangGraph Router · Gmail & Contacts · ImageKit CDN Storage
          </p>
        </div>
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        onSendEmail={onSendMessage}
      />

      {/* Google Photos & ImageKit Gallery Modal */}
      <PhotosGalleryModal
        isOpen={isPhotosModalOpen}
        onClose={() => setIsPhotosModalOpen(false)}
      />
    </div>
  );
}
