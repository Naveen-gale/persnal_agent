import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { MessageSquare, Plus, Trash2, Bot, LogOut, CheckCircle2, Cpu, Mail, X } from 'lucide-react';

export function ConversationSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenGoogleModal,
  onOpenCapabilitiesModal,
  isOpenMobile,
  onCloseMobile,
}) {
  const { user, logout, googleStatus } = useAuth();
  const isGoogleConnected = !!(googleStatus && googleStatus.connected);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full shrink-0 transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Workspace Brand Header */}
        <div className="p-4 border-b border-zinc-800/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
                <Bot size={17} />
              </div>
              <div>
                <span className="block text-xs font-semibold text-zinc-200 tracking-tight">Personal Agent</span>
                <span className="block text-[10px] text-zinc-500 font-mono">v1.0 · Private</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 md:hidden transition"
              title="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={() => {
              onNewConversation();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 transition shadow-sm"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 px-2 py-1.5">
            Conversations
          </div>

          {conversations.length === 0 ? (
            <div className="py-8 px-3 text-center text-xs text-zinc-600">
              No conversations yet. Start a new session above.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv._id === activeId;
              return (
                <div
                  key={conv._id}
                  onClick={() => {
                    onSelectConversation(conv._id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition border ${
                    isActive
                      ? 'bg-zinc-900 text-zinc-100 border-zinc-800 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border-transparent'
                  }`}
                >
                  <MessageSquare size={14} className={`shrink-0 ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`} />
                  <span className="flex-1 truncate" title={conv.title || 'Untitled Session'}>
                    {conv.title || 'Untitled Session'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this conversation?')) {
                        onDeleteConversation(conv._id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded transition"
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Integrations & Tool Panel */}
        <div className="p-3 border-t border-zinc-800/80 space-y-2 shrink-0 bg-zinc-950">
          <button
            onClick={() => {
              onOpenGoogleModal();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 text-xs text-zinc-300 transition"
          >
            <div className="flex items-center gap-2">
              <Mail size={14} className={isGoogleConnected ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Google Account</span>
            </div>
            {isGoogleConnected ? (
              <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 size={11} className="mr-1" />
                Connected
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500">Not connected</span>
            )}
          </button>

          <button
            onClick={() => {
              onOpenCapabilitiesModal();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 text-xs text-zinc-300 transition"
          >
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-zinc-400" />
              <span>Agent Tools</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Groq</span>
          </button>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 shrink-0">
              {(user && user.name ? user.name[0] : 'U').toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-medium text-zinc-200 truncate">{user ? user.name : 'User'}</span>
              <span className="block text-[10px] text-zinc-500 truncate">{user ? user.email : ''}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition shrink-0"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
