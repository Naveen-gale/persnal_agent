import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Mail, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, X, Database, Lock } from 'lucide-react';

export function GoogleIntegrationModal({ isOpen, onClose }) {
  const { googleStatus, refreshGoogleStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncJob, setSyncJob] = useState(null);
  const [resyncing, setResyncing] = useState(false);
  const pollTimerRef = useRef(null);

  const fetchSyncStatus = async () => {
    try {
      const job = await api.getSyncJobStatus();
      setSyncJob(job);
      return job;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshGoogleStatus();
      fetchSyncStatus();
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, refreshGoogleStatus]);

  // Poll sync status if active
  useEffect(() => {
    if (syncJob && (syncJob.status === 'syncing' || syncJob.status === 'pending')) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(async () => {
          const job = await fetchSyncStatus();
          if (job && job.status !== 'syncing' && job.status !== 'pending') {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }, 1500);
      }
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [syncJob]);

  if (!isOpen) return null;

  const isConnected = !!(googleStatus && googleStatus.connected);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError('');
      const authUrl = await api.getGoogleConnectUrl();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err) {
      setError(err.message || 'Failed to generate Google connection URL.');
      setLoading(false);
    }
  };

  const handleResyncAll = async () => {
    try {
      setResyncing(true);
      setError('');
      const res = await api.resyncAllGoogleData();
      if (res?.syncJob) {
        setSyncJob(res.syncJob);
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger resync.');
    } finally {
      setResyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google account? Your saved tokens will be deleted from the database.')) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.disconnectGoogle();
      await refreshGoogleStatus();
      setSyncJob(null);
    } catch (err) {
      setError(err.message || 'Failed to disconnect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
              <Mail className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Google Integration</h2>
              <p className="text-xs text-zinc-400">Gmail, Google Contacts & Drive synchronization</p>
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

        {/* Scrollable Content */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Connection Status Box */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Connection Status</span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                  <XCircle className="w-3.5 h-3.5" /> Not Connected
                </span>
              )}
            </div>

            {isConnected && (
              <div className="pt-3 border-t border-zinc-800/80 space-y-2 text-xs">
                {googleStatus.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Connected Account:</span>
                    <span className="text-zinc-200 font-medium font-mono text-[11px]">{googleStatus.email}</span>
                  </div>
                )}
                {googleStatus.connectedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Authorized Since:</span>
                    <span className="text-zinc-200">
                      {new Date(googleStatus.connectedAt).toLocaleDateString()} {new Date(googleStatus.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {googleStatus.scopes && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-zinc-400 block">Granted Permissions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {googleStatus.scopes.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[10px]">
                          {s.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent Sync Status Card */}
          {isConnected && (
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-zinc-300" />
                  <span className="text-xs font-semibold text-zinc-200">Persistent DB & ImageKit Sync</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                    syncJob?.status === 'completed'
                      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                      : syncJob?.status === 'syncing' || syncJob?.status === 'pending'
                      ? 'bg-blue-950/50 text-blue-400 border-blue-800/50'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {(syncJob?.status === 'syncing' || syncJob?.status === 'pending') && (
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                  )}
                  {syncJob?.status === 'completed'
                    ? 'Synced to DB'
                    : syncJob?.status === 'syncing'
                    ? 'Syncing in background...'
                    : syncJob?.status === 'pending'
                    ? 'Pending...'
                    : 'Ready'}
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {syncJob?.message || 'When connected, your data automatically syncs to MongoDB and ImageKit even if you close the browser.'}
              </p>

              {/* Counters grid */}
              <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100 font-mono">{syncJob?.contacts?.synced || 0}</span>
                  <span className="text-[10px] text-zinc-500 font-medium">Contacts</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100 font-mono">{syncJob?.gmail?.synced || 0}</span>
                  <span className="text-[10px] text-zinc-500 font-medium">Emails</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100 font-mono">{syncJob?.drive?.synced || 0}</span>
                  <span className="text-[10px] text-zinc-500 font-medium">Drive Files</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-zinc-100 font-mono">{syncJob?.photos?.synced || 0}</span>
                  <span className="text-[10px] text-zinc-500 font-medium">Photos (CDN)</span>
                </div>
              </div>

              {/* Manual Resync Trigger */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleResyncAll}
                  disabled={resyncing || syncJob?.status === 'syncing'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-750 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${resyncing || syncJob?.status === 'syncing' ? 'animate-spin' : ''}`} />
                  {syncJob?.status === 'syncing' ? 'Syncing in Background…' : 'Resync All Data'}
                </button>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Full Data Ownership & Persistence</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Google Contacts, Gmail messages, and Drive file records are saved to your private MongoDB collection keyed by your user email. Google Photos are securely duplicated on ImageKit CDN so the agent can read and process them instantly.
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-end gap-2.5">
          {isConnected ? (
            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={handleConnect}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-authorize Google
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-medium bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white transition-colors shadow-sm disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {loading ? 'Redirecting to Google...' : 'Connect Google Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
