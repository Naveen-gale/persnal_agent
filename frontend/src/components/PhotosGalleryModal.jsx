import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client.js';
import {
  Image as ImageIcon,
  RefreshCw,
  X,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Upload,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Check,
  Eye,
} from 'lucide-react';

export function PhotosGalleryModal({ isOpen, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState(null);
  const [activePickerSession, setActivePickerSession] = useState(null);
  const [uploadingDirect, setUploadingDirect] = useState(false);

  // Framing & Display Mode ('cover' | 'contain')
  const [fitMode, setFitMode] = useState('cover');

  // Lightbox / Inspection State ("Lock image clearly")
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const liveRefreshCountRef = useRef(0);

  // Fetch photos from backend with optional silent refresh
  const fetchPhotos = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');

      const data = await api.getPhotos(1, 200);
      setPhotos(data.photos || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Could not load synced photos.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Poll live synchronization progress from backend & reload photos in real-time
  const startProgressPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    liveRefreshCountRef.current = 0;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.getPhotoSyncProgress();
        const progress = res?.progress;
        if (!progress) return;

        setSyncProgress(progress);

        // Real-time photo reload feature: Every ~2.4 seconds while syncing, refresh photos live
        liveRefreshCountRef.current += 1;
        if (liveRefreshCountRef.current % 3 === 0) {
          fetchPhotos(true);
        }

        if (progress.status === 'completed') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSyncing(false);
          setSyncMessage(progress.message || 'Photos successfully stored in ImageKit!');
          await fetchPhotos(false);
        } else if (progress.status === 'error') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSyncing(false);
          setError(progress.message || 'Photo synchronization failed.');
        }
      } catch (pollErr) {
        console.warn('Progress poll notice:', pollErr.message);
      }
    }, 800);
  }, [fetchPhotos]);

  useEffect(() => {
    if (isOpen) {
      fetchPhotos(false);

      // Check if an existing sync is already in flight
      api.getPhotoSyncProgress()
        .then((res) => {
          if (res?.progress && res.progress.status === 'syncing') {
            setSyncing(true);
            setSyncProgress(res.progress);
            startProgressPolling();
          }
        })
        .catch(() => {});
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, fetchPhotos, startProgressPolling]);

  // Keyboard navigation for Lightbox modal
  useEffect(() => {
    if (selectedPhotoIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedPhotoIndex(null);
        setZoomScale(1.0);
      } else if (e.key === 'ArrowLeft') {
        setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
        setZoomScale(1.0);
      } else if (e.key === 'ArrowRight') {
        setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
        setZoomScale(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, photos.length]);

  if (!isOpen) return null;

  // Trigger automated Google Photos / Drive background sync
  const handleAutoSync = async () => {
    try {
      setSyncing(true);
      setError('');
      setSyncMessage('');
      setSyncProgress({
        status: 'syncing',
        phase: 'Connecting to Google...',
        current: 0,
        total: 0,
        percent: 8,
        message: 'Starting photo sync to ImageKit...',
      });

      startProgressPolling();
      const res = await api.syncPhotos(500);

      if (res?.status === 'syncing') {
        setSyncProgress(res.progress || {
          status: 'syncing',
          phase: 'Syncing in background...',
          percent: 15,
          message: 'Downloading photos and storing in ImageKit...',
        });
      }
    } catch (err) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setSyncing(false);
      setError(err.message || 'Photo synchronization failed.');
    }
  };

  // Google Photos Picker session flow
  const handleOpenPicker = async () => {
    try {
      setError('');
      setSyncMessage('');
      setLoading(true);

      const session = await api.createPhotosPickerSession();
      setActivePickerSession(session.sessionId);

      window.open(
        session.pickerUri,
        'GooglePhotosPicker',
        'width=900,height=700,menubar=no,toolbar=no,location=no,status=no'
      );

      setSyncMessage(
        'Google Photos Picker window is open! Select the photos you want, click "Done" in Google, then click "Complete Sync to ImageKit" below.'
      );
    } catch (err) {
      if (err.status === 403 || err.message?.includes('403') || err.message?.includes('permission')) {
        setError(
          'Google Photos Picker scope is not yet authorized on your account. Click "Re-authorize Google for Photos" below.'
        );
      } else {
        setError(err.message || 'Could not launch Google Photos Picker.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Complete Picker Sync once user selected photos
  const handleCompletePickerSync = async () => {
    if (!activePickerSession) return;
    try {
      setSyncing(true);
      setError('');
      setSyncMessage('');
      setSyncProgress({
        status: 'syncing',
        phase: 'Retrieving photos from picker session...',
        current: 0,
        total: 0,
        percent: 10,
        message: 'Importing chosen photos from Google Photos to ImageKit...',
      });

      startProgressPolling();
      await api.completePhotosPickerSync(activePickerSession);
      setActivePickerSession(null);
    } catch (err) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setSyncing(false);
      setError(err.message || 'Failed to complete Google Photos Picker sync.');
    }
  };

  // Direct photo upload
  const handleDirectUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDirect(true);
      setError('');
      setSyncMessage(`Uploading "${file.name}" directly to ImageKit...`);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          await api.uploadPhotoDirect(base64, file.name, file.type || 'image/jpeg');
          setSyncMessage(`Photo "${file.name}" was uploaded and stored in ImageKit successfully!`);
          await fetchPhotos(false);
        } catch (uploadErr) {
          setError(uploadErr.message || 'Failed to upload photo to ImageKit.');
        } finally {
          setUploadingDirect(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message || 'Could not read image file.');
      setUploadingDirect(false);
    } finally {
      e.target.value = '';
    }
  };

  // Re-authorize Google OAuth
  const handleReauthorizeGoogle = async () => {
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

  const handleCopyLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isScopeError =
    error.includes('insufficient authentication scopes') ||
    error.includes('403') ||
    error.includes('permission') ||
    syncProgress?.requiresReauth;

  const currentPercent = Math.min(Math.max(syncProgress?.percent || 0, 5), 100);
  const activePhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
              <ImageIcon className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Google Photos & ImageKit CDN</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  <ShieldCheck className="w-3 h-3" /> ImageKit Active
                </span>
                {syncing && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Syncing
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Backed up and served securely through private ImageKit CDN</p>
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

        {/* Real-time Progress Bar & Loader */}
        {(syncing || uploadingDirect) && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-zinc-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                <span>
                  {uploadingDirect
                    ? 'Uploading directly to ImageKit...'
                    : syncProgress?.phase || 'Syncing Photos to ImageKit...'}
                </span>
              </div>
              <span className="font-mono font-semibold text-zinc-100">
                {uploadingDirect ? '...' : `${currentPercent}%`}
              </span>
            </div>

            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-200 transition-all duration-300 rounded-full"
                style={{ width: uploadingDirect ? '85%' : `${currentPercent}%` }}
              />
            </div>

            <div className="text-[11px] text-zinc-400 truncate">
              {uploadingDirect
                ? 'Streaming image to ImageKit CDN storage...'
                : syncProgress?.message || 'Processing and transferring photos...'}
            </div>
          </div>
        )}

        {/* Error message box */}
        {error && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1 space-y-2">
              <span className="block leading-relaxed">{error}</span>
              {isScopeError && (
                <div>
                  <button
                    onClick={handleReauthorizeGoogle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/60 text-red-100 hover:bg-red-800/80 transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    Re-authorize Google with Photos Scopes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success message box */}
        {syncMessage && !syncing && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{syncMessage}</span>
          </div>
        )}

        {/* Active Picker Session Banner */}
        {activePickerSession && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Sparkles className="w-4 h-4 text-zinc-300" />
              <span>Google Photos Picker Session Active</span>
            </div>
            <p className="text-xs text-zinc-400">
              Once you finish choosing photos in the popup window, click below to import them into ImageKit.
            </p>
            <button
              onClick={handleCompletePickerSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Complete Sync to ImageKit
            </button>
          </div>
        )}

        {/* Top Control & Action Bar */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b border-zinc-800 shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs text-zinc-300">
              <strong className="font-semibold text-zinc-100 font-mono">{photos.length}</strong> {photos.length === 1 ? 'photo' : 'photos'} in CDN
            </span>

            {/* Real-time Reload Button */}
            <button
              onClick={() => fetchPhotos(false)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/80 hover:bg-zinc-750 hover:text-white transition-colors disabled:opacity-50"
              title="Reload photos list from server in real time"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing || loading ? 'animate-spin' : ''}`} />
              Reload Photos
            </button>

            {lastUpdated && (
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                Updated {lastUpdated}
              </span>
            )}

            {/* Fit Framing Mode Switch */}
            <div className="inline-flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <span className="text-[10px] text-zinc-500 uppercase px-2 font-mono">Fit</span>
              <button
                onClick={() => setFitMode('cover')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  fitMode === 'cover'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Fill card neatly (Cover)"
              >
                Fill
              </button>
              <button
                onClick={() => setFitMode('contain')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  fitMode === 'contain'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Show whole uncropped image (Contain)"
              >
                Fit Whole
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden file input for direct upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*"
              className="hidden"
            />

            <button
              onClick={handleDirectUploadClick}
              disabled={syncing || uploadingDirect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-750 hover:text-white transition-colors disabled:opacity-50"
              title="Upload photo from your computer directly to ImageKit"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Local
            </button>

            <button
              onClick={handleOpenPicker}
              disabled={syncing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-750 hover:text-white transition-colors disabled:opacity-50"
              title="Select photos interactively with Google Photos Picker"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Picker Selection
            </button>

            <button
              onClick={handleAutoSync}
              disabled={syncing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white transition-colors disabled:opacity-50"
              title="Scan and synchronize all photos to ImageKit"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync All Photos'}
            </button>
          </div>
        </div>

        {/* Content Area with Visible Styled Scrollbar */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar min-h-[220px]">
          {loading ? (
            <div className="py-20 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2.5">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
              <span>Loading photos from ImageKit CDN...</span>
            </div>
          ) : photos.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 mb-4">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-1">No photos stored in ImageKit yet</h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Connect your Google account and click <strong>"Sync All Photos"</strong>, select photos with <strong>"Picker Selection"</strong>, or upload directly from your device.
              </p>
              <div className="flex gap-2.5 flex-wrap justify-center">
                <button
                  onClick={handleOpenPicker}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-750 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Select from Google
                </button>
                <button
                  onClick={handleAutoSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Start Full Sync
                </button>
                <button
                  onClick={handleDirectUploadClick}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-750 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Local File
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {photos.map((photo, idx) => (
                <div
                  key={photo._id || photo.imageKitFileId || idx}
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    setZoomScale(1.0);
                  }}
                  className="group flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:border-zinc-700 transition-all hover:shadow-lg"
                  title={`Click to inspect: ${photo.filename}`}
                >
                  <div className="relative w-full h-36 bg-zinc-950 overflow-hidden flex items-center justify-center">
                    <img
                      src={photo.thumbnailUrl || photo.imageKitUrl}
                      alt={photo.filename}
                      className={`w-full h-full transition-transform duration-200 group-hover:scale-105 ${
                        fitMode === 'contain' ? 'object-contain' : 'object-cover'
                      }`}
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-zinc-300 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded border border-white/10 z-10">
                      CDN
                    </span>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <Eye className="w-5 h-5 drop-shadow" />
                      <span className="text-[10px] font-medium mt-1">View</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-300 bg-zinc-900 border-t border-zinc-800/80">
                    <span className="truncate max-w-[120px] font-medium" title={photo.filename}>
                      {photo.filename}
                    </span>
                    <Maximize2 className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox / High-Resolution Lock View Overlay */}
        {activePhoto && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
            onClick={() => {
              setSelectedPhotoIndex(null);
              setZoomScale(1.0);
            }}
          >
            <div
              className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-xs font-semibold text-zinc-100 truncate max-w-xs sm:max-w-md" title={activePhoto.filename}>
                    {activePhoto.filename}
                  </span>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    ({selectedPhotoIndex + 1} of {photos.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomScale((prev) => Math.min(prev + 0.25, 3.0))}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomScale((prev) => Math.max(prev - 0.25, 0.75))}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomScale(1.0)}
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-[11px] font-mono transition-colors"
                    title="Reset to 100%"
                  >
                    {Math.round(zoomScale * 100)}%
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex(null);
                      setZoomScale(1.0);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors ml-1"
                    title="Close (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lightbox Image Viewport */}
              <div className="relative flex-1 min-h-[350px] max-h-[66vh] flex items-center justify-center bg-black/90 overflow-auto p-4 custom-scrollbar">
                {photos.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                      setZoomScale(1.0);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors z-20"
                    title="Previous photo (Left arrow)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={activePhoto.imageKitUrl || activePhoto.thumbnailUrl}
                    alt={activePhoto.filename}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
                    style={{ transform: `scale(${zoomScale})` }}
                  />
                </div>

                {photos.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                      setZoomScale(1.0);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors z-20"
                    title="Next photo (Right arrow)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Lightbox Footer Bar */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/90 text-xs shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-zinc-400">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> ImageKit CDN
                  </span>
                  {activePhoto.creationTime && (
                    <span className="text-[11px]">
                      {new Date(activePhoto.creationTime).toLocaleDateString()} {new Date(activePhoto.creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {activePhoto.mimeType && (
                    <span className="text-[11px] font-mono text-zinc-500">{activePhoto.mimeType}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(activePhoto.imageKitUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-750 transition-colors"
                    title="Copy ImageKit CDN URL"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy CDN Link
                      </>
                    )}
                  </button>

                  <a
                    href={activePhoto.imageKitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
                    title="Open original image in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Original
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
