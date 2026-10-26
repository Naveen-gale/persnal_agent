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
  Grid,
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

  // Fetch photos from backend with optional silent refresh (no full-page spinner)
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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.headerTitleRow}>
            <div style={styles.iconBadge}>
              <ImageIcon size={24} color="#ec4899" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={styles.title}>Google Photos & ImageKit CDN</h2>
                <span style={styles.cdnBadge}>
                  <ShieldCheck size={12} color="#10b981" style={{ marginRight: 4 }} />
                  ImageKit Active
                </span>
                {syncing && (
                  <span style={styles.liveSyncBadge}>
                    <span className="live-pulse-dot" style={{ marginRight: 6 }} />
                    Live Syncing
                  </span>
                )}
              </div>
              <p style={styles.subtitle}>All user photos are backed up and served via ImageKit CDN</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Real-time Progress Bar & Loader */}
        {(syncing || uploadingDirect) && (
          <div style={styles.progressBarCard}>
            <div style={styles.progressHeader}>
              <div style={styles.progressStatusText}>
                <RefreshCw size={14} className="animate-spin" color="#ec4899" style={{ marginRight: 8 }} />
                <span>
                  {uploadingDirect
                    ? 'Uploading directly to ImageKit...'
                    : syncProgress?.phase || 'Syncing Photos to ImageKit...'}
                </span>
              </div>
              <span style={styles.progressPercent}>{uploadingDirect ? '...' : `${currentPercent}%`}</span>
            </div>

            <div style={styles.progressBarTrack}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: uploadingDirect ? '85%' : `${currentPercent}%`,
                }}
              />
            </div>

            <div style={styles.progressFooterMessage}>
              {uploadingDirect
                ? 'Streaming image to ImageKit CDN storage...'
                : syncProgress?.message || 'Processing and transferring photos...'}
            </div>
          </div>
        )}

        {/* Error message box */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', lineHeight: 1.4 }}>{error}</span>
              {isScopeError && (
                <div style={{ marginTop: '8px' }}>
                  <button onClick={handleReauthorizeGoogle} style={styles.reauthBtnInline}>
                    <Lock size={13} style={{ marginRight: 6 }} />
                    Re-authorize Google with Photos Scopes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success message box */}
        {syncMessage && !syncing && (
          <div style={styles.successBox}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{syncMessage}</span>
          </div>
        )}

        {/* Active Picker Session Banner */}
        {activePickerSession && (
          <div style={styles.pickerActiveBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#3b82f6" />
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#93c5fd' }}>
                Google Photos Picker Session Active
              </span>
            </div>
            <p style={{ margin: '4px 0 10px 0', fontSize: '12px', color: '#cbd5e1' }}>
              Once you finish choosing your photos in the Google Photos window, click below to sync them into ImageKit.
            </p>
            <button
              onClick={handleCompletePickerSync}
              disabled={syncing}
              style={styles.pickerCompleteBtn}
            >
              <ArrowRight size={14} style={{ marginRight: 6 }} />
              Complete Sync to ImageKit
            </button>
          </div>
        )}

        {/* Top Control & Action Bar */}
        <div style={styles.topActionsRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={styles.photoCount}>
              <strong>{photos.length}</strong> {photos.length === 1 ? 'photo' : 'photos'} in ImageKit
            </span>

            {/* Real-time Reload Button */}
            <button
              onClick={() => fetchPhotos(false)}
              disabled={loading || refreshing}
              style={styles.realtimeReloadBtn}
              title="Reload photos list from server in real time"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? 'animate-spin' : ''}
                style={{ marginRight: 5 }}
              />
              Reload Photos
            </button>

            {lastUpdated && (
              <span style={styles.lastUpdatedText}>
                Updated {lastUpdated}
              </span>
            )}

            {/* Fit Framing Mode Switch */}
            <div style={styles.fitModeGroup}>
              <span style={styles.fitModeLabel}>Fit:</span>
              <button
                onClick={() => setFitMode('cover')}
                style={{
                  ...styles.fitModeBtn,
                  ...(fitMode === 'cover' ? styles.fitModeBtnActive : {}),
                }}
                title="Fill card neatly (Cover)"
              >
                Fill
              </button>
              <button
                onClick={() => setFitMode('contain')}
                style={{
                  ...styles.fitModeBtn,
                  ...(fitMode === 'contain' ? styles.fitModeBtnActive : {}),
                }}
                title="Show whole uncropped image (Contain)"
              >
                Fit Whole
              </button>
            </div>
          </div>

          <div style={styles.actionButtonGroup}>
            {/* Hidden file input for direct upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*"
              style={{ display: 'none' }}
            />

            <button
              onClick={handleDirectUploadClick}
              disabled={syncing || uploadingDirect}
              style={styles.uploadBtn}
              title="Upload photo from your computer directly to ImageKit"
            >
              <Upload size={14} style={{ marginRight: 6 }} />
              Upload Photo
            </button>

            <button
              onClick={handleOpenPicker}
              disabled={syncing || loading}
              style={styles.pickerBtn}
              title="Select photos interactively with Google Photos Picker"
            >
              <Sparkles size={14} style={{ marginRight: 6 }} />
              Select from Google Photos
            </button>

            <button
              onClick={handleAutoSync}
              disabled={syncing || loading}
              style={styles.syncBtn}
              title="Scan and synchronize all photos to ImageKit"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} style={{ marginRight: 6 }} />
              {syncing ? 'Syncing...' : 'Sync from Google'}
            </button>
          </div>
        </div>

        {/* Content Area with Visible Styled Scrollbar */}
        <div style={styles.scrollContainer} className="custom-scrollbar">
          {loading ? (
            <div style={styles.emptyState}>
              <RefreshCw size={28} className="animate-spin" color="#ec4899" style={{ marginBottom: 12 }} />
              <span style={{ color: '#cbd5e1', fontSize: '14px' }}>Loading photos from ImageKit CDN...</span>
            </div>
          ) : photos.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIconCircle}>
                <ImageIcon size={32} color="#ec4899" />
              </div>
              <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>
                No photos stored in ImageKit yet
              </p>
              <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#94a3b8', maxWidth: '440px', lineHeight: 1.5 }}>
                Connect your Google account and click <strong>"Sync from Google"</strong>, select photos with{' '}
                <strong>"Select from Google Photos"</strong>, or upload directly from your device.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={handleOpenPicker} disabled={syncing} style={styles.pickerBtn}>
                  <Sparkles size={14} style={{ marginRight: 6 }} />
                  Select from Google Photos
                </button>
                <button onClick={handleAutoSync} disabled={syncing} style={styles.syncBtn}>
                  <RefreshCw size={14} style={{ marginRight: 6 }} />
                  Start Photo Sync
                </button>
                <button onClick={handleDirectUploadClick} disabled={syncing} style={styles.uploadBtn}>
                  <Upload size={14} style={{ marginRight: 6 }} />
                  Upload Local Photo
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.galleryGrid} className="custom-scrollbar">
              {photos.map((photo, idx) => (
                <div
                  key={photo._id || photo.imageKitFileId || idx}
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    setZoomScale(1.0);
                  }}
                  style={styles.photoCard}
                  title={`Click to lock and view photo clearly: ${photo.filename}`}
                >
                  <div style={styles.photoImgWrapper}>
                    <img
                      src={photo.thumbnailUrl || photo.imageKitUrl}
                      alt={photo.filename}
                      style={{
                        ...styles.photoImg,
                        objectFit: fitMode,
                        backgroundColor: fitMode === 'contain' ? '#070b14' : '#1e293b',
                      }}
                      loading="lazy"
                    />
                    <span style={styles.ikTag}>ImageKit</span>
                    <div style={styles.cardHoverOverlay}>
                      <Eye size={18} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} />
                      <span style={styles.hoverOverlayText}>Lock & View</span>
                    </div>
                  </div>
                  <div style={styles.photoFooter}>
                    <span style={styles.photoName} title={photo.filename}>
                      {photo.filename}
                    </span>
                    <Maximize2 size={12} color="#94a3b8" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox / High-Resolution Lock View Overlay */}
        {activePhoto && (
          <div
            style={styles.lightboxOverlay}
            onClick={() => {
              setSelectedPhotoIndex(null);
              setZoomScale(1.0);
            }}
          >
            <div
              style={styles.lightboxModal}
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-in"
            >
              {/* Lightbox Header Bar */}
              <div style={styles.lightboxHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <ImageIcon size={18} color="#ec4899" style={{ flexShrink: 0 }} />
                  <span style={styles.lightboxTitle} title={activePhoto.filename}>
                    {activePhoto.filename}
                  </span>
                  <span style={styles.lightboxCounter}>
                    ({selectedPhotoIndex + 1} of {photos.length})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Zoom In */}
                  <button
                    onClick={() => setZoomScale((prev) => Math.min(prev + 0.25, 3.0))}
                    style={styles.lightboxIconBtn}
                    title="Zoom in"
                  >
                    <ZoomIn size={16} />
                  </button>

                  {/* Zoom Out */}
                  <button
                    onClick={() => setZoomScale((prev) => Math.max(prev - 0.25, 0.75))}
                    style={styles.lightboxIconBtn}
                    title="Zoom out"
                  >
                    <ZoomOut size={16} />
                  </button>

                  {/* Reset Zoom */}
                  <button
                    onClick={() => setZoomScale(1.0)}
                    style={styles.lightboxResetBtn}
                    title="Reset to 100%"
                  >
                    {Math.round(zoomScale * 100)}%
                  </button>

                  {/* Close Lightbox */}
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex(null);
                      setZoomScale(1.0);
                    }}
                    style={styles.lightboxCloseBtn}
                    title="Close preview (Esc)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Lightbox Image Viewport ("Lock Image Clearly") */}
              <div style={styles.lightboxViewport} className="custom-scrollbar">
                {/* Previous Navigation Arrow */}
                {photos.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                      setZoomScale(1.0);
                    }}
                    style={styles.navArrowLeft}
                    title="Previous photo (Left arrow)"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}

                <div style={styles.imageLockFrame}>
                  <img
                    src={activePhoto.imageKitUrl || activePhoto.thumbnailUrl}
                    alt={activePhoto.filename}
                    style={{
                      ...styles.lockedImg,
                      transform: `scale(${zoomScale})`,
                      transition: 'transform 0.18s ease-out',
                    }}
                  />
                </div>

                {/* Next Navigation Arrow */}
                {photos.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                      setZoomScale(1.0);
                    }}
                    style={styles.navArrowRight}
                    title="Next photo (Right arrow)"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}
              </div>

              {/* Lightbox Footer Bar */}
              <div style={styles.lightboxFooter}>
                <div style={styles.lightboxMeta}>
                  <span style={styles.cdnBadge}>
                    <ShieldCheck size={12} color="#10b981" style={{ marginRight: 4 }} />
                    Stored on ImageKit CDN
                  </span>
                  {activePhoto.creationTime && (
                    <span style={styles.metaText}>
                      Date: {new Date(activePhoto.creationTime).toLocaleDateString()} {new Date(activePhoto.creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {activePhoto.mimeType && (
                    <span style={styles.metaText}>Type: {activePhoto.mimeType}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Copy Link */}
                  <button
                    onClick={() => handleCopyLink(activePhoto.imageKitUrl)}
                    style={styles.copyLinkBtn}
                    title="Copy ImageKit CDN URL"
                  >
                    {copiedUrl ? (
                      <>
                        <Check size={13} color="#10b981" style={{ marginRight: 5 }} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={13} style={{ marginRight: 5 }} />
                        Copy ImageKit Link
                      </>
                    )}
                  </button>

                  {/* Open in New Tab */}
                  <a
                    href={activePhoto.imageKitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.openExternalBtn}
                    title="Open original high-res image in new tab"
                  >
                    <ExternalLink size={13} style={{ marginRight: 5 }} />
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

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '16px',
  },
  modal: {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '18px',
    width: '100%',
    maxWidth: '920px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '22px 24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
    overflow: 'hidden',
    position: 'relative',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '14px',
    flexShrink: 0,
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBadge: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: 'rgba(236, 72, 153, 0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    flexShrink: 0,
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '3px 0 0 0',
  },
  cdnBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  liveSyncBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'rgba(236, 72, 153, 0.14)',
    color: '#f472b6',
    border: '1px solid rgba(236, 72, 153, 0.35)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  progressBarCard: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    flexShrink: 0,
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressStatusText: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  progressPercent: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ec4899',
  },
  progressBarTrack: {
    height: '7px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '999px',
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #ec4899, #a855f7, #3b82f6)',
    borderRadius: '999px',
    transition: 'width 0.35s ease',
  },
  progressFooterMessage: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '10px',
    color: '#fca5a5',
    fontSize: '13px',
    marginBottom: '12px',
    flexShrink: 0,
  },
  reauthBtnInline: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#ea4335',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '10px',
    color: '#34d399',
    fontSize: '13px',
    marginBottom: '12px',
    flexShrink: 0,
  },
  pickerActiveBox: {
    padding: '12px 14px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    borderRadius: '10px',
    marginBottom: '12px',
    flexShrink: 0,
  },
  pickerCompleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  topActionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px',
    flexShrink: 0,
  },
  photoCount: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
  realtimeReloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    color: '#f472b6',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  lastUpdatedText: {
    fontSize: '11px',
    color: '#64748b',
  },
  fitModeGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '2px',
    gap: '2px',
  },
  fitModeLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    padding: '0 6px',
  },
  fitModeBtn: {
    padding: '3px 8px',
    fontSize: '11px',
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  fitModeBtnActive: {
    backgroundColor: '#ec4899',
    color: '#ffffff',
    fontWeight: '600',
  },
  actionButtonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  pickerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    backgroundColor: '#4338ca',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  syncBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    backgroundColor: '#db2777',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    minHeight: '200px',
    maxHeight: '56vh',
    paddingRight: '6px',
  },
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
    border: '1px solid rgba(236, 72, 153, 0.25)',
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
    gap: '14px',
    paddingBottom: '16px',
  },
  photoCard: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0b1120',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
  },
  photoImgWrapper: {
    position: 'relative',
    width: '100%',
    height: '145px',
    backgroundColor: '#070b14',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    display: 'block',
    transition: 'transform 0.2s ease',
  },
  cardHoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.15s ease',
  },
  hoverOverlayText: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#ffffff',
    marginTop: '4px',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  ikTag: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(4px)',
    color: '#ec4899',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(236, 72, 153, 0.4)',
    zIndex: 2,
  },
  photoFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    fontSize: '12px',
    color: '#cbd5e1',
    backgroundColor: '#0b1120',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  photoName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '130px',
    fontWeight: '500',
  },

  // Lightbox / High-Resolution Lock View Overlay Styles
  lightboxOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
    padding: '20px',
  },
  lightboxModal: {
    backgroundColor: '#090d16',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '1000px',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.95)',
    overflow: 'hidden',
  },
  lightboxHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0f172a',
    flexShrink: 0,
  },
  lightboxTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '380px',
  },
  lightboxCounter: {
    fontSize: '12px',
    color: '#64748b',
    flexShrink: 0,
  },
  lightboxIconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
  },
  lightboxResetBtn: {
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    backgroundColor: '#1e293b',
    color: '#ec4899',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    cursor: 'pointer',
  },
  lightboxCloseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    cursor: 'pointer',
    marginLeft: '6px',
  },
  lightboxViewport: {
    position: 'relative',
    flex: 1,
    minHeight: '400px',
    maxHeight: '68vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712',
    overflow: 'auto',
    padding: '16px',
  },
  imageLockFrame: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  lockedImg: {
    maxWidth: '100%',
    maxHeight: '62vh',
    objectFit: 'contain',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
  },
  navArrowLeft: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    zIndex: 10,
    transition: 'all 0.15s ease',
  },
  navArrowRight: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    zIndex: 10,
    transition: 'all 0.15s ease',
  },
  lightboxFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0f172a',
    flexWrap: 'wrap',
    gap: '10px',
    flexShrink: 0,
  },
  lightboxMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  copyLinkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  openExternalBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    color: '#f472b6',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
