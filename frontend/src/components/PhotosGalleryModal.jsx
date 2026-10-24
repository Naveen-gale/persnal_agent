import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import {
  Image,
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
} from 'lucide-react';

export function PhotosGalleryModal({ isOpen, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState(null);
  const [activePickerSession, setActivePickerSession] = useState(null);
  const [uploadingDirect, setUploadingDirect] = useState(false);

  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getPhotos(1, 100);
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err.message || 'Could not load synced photos.');
    } finally {
      setLoading(false);
    }
  };

  // Poll live synchronization progress from backend
  const startProgressPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.getPhotoSyncProgress();
        const progress = res?.progress;
        if (!progress) return;

        setSyncProgress(progress);

        if (progress.status === 'completed') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSyncing(false);
          setSyncMessage(progress.message || 'Photos successfully stored in ImageKit!');
          await fetchPhotos();
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchPhotos();

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
  }, [isOpen]);

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
      const res = await api.syncPhotos(30);

      if (res?.status === 'syncing') {
        // Background sync initiated successfully
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

  // Modern Google Photos Picker flow
  const handleOpenPicker = async () => {
    try {
      setError('');
      setSyncMessage('');
      setLoading(true);

      const session = await api.createPhotosPickerSession();
      setActivePickerSession(session.sessionId);

      // Open Google Photos Picker UI in a popup window
      const pickerWindow = window.open(
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

  // Direct photo upload from user computer/device
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
          await fetchPhotos();
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

  const isScopeError =
    error.includes('insufficient authentication scopes') ||
    error.includes('403') ||
    error.includes('permission') ||
    syncProgress?.requiresReauth;

  const currentPercent = Math.min(Math.max(syncProgress?.percent || 0, 5), 100);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.headerTitleRow}>
            <div style={styles.iconBadge}>
              <Image size={24} color="#ec4899" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={styles.title}>Google Photos & ImageKit CDN</h2>
                <span style={styles.cdnBadge}>
                  <ShieldCheck size={12} color="#10b981" style={{ marginRight: 4 }} />
                  ImageKit Active
                </span>
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

        {/* Top Actions Row */}
        <div style={styles.topActionsRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.photoCount}>
              <strong>{photos.length}</strong> {photos.length === 1 ? 'photo' : 'photos'} in ImageKit
            </span>
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
              title="Scan and synchronize photos to ImageKit"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} style={{ marginRight: 6 }} />
              {syncing ? 'Syncing...' : 'Sync from Google'}
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div style={styles.emptyState}>
            <RefreshCw size={28} className="animate-spin" color="#ec4899" style={{ marginBottom: 12 }} />
            <span style={{ color: '#cbd5e1', fontSize: '14px' }}>Loading photos from ImageKit CDN...</span>
          </div>
        ) : photos.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconCircle}>
              <Image size={32} color="#ec4899" />
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
          <div style={styles.galleryGrid}>
            {photos.map((photo) => (
              <a
                key={photo._id || photo.imageKitFileId}
                href={photo.imageKitUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.photoCard}
                title={`Open on ImageKit CDN: ${photo.filename}`}
              >
                <div style={styles.photoImgWrapper}>
                  <img
                    src={photo.thumbnailUrl || photo.imageKitUrl}
                    alt={photo.filename}
                    style={styles.photoImg}
                    loading="lazy"
                  />
                  <span style={styles.ikTag}>ImageKit</span>
                </div>
                <div style={styles.photoFooter}>
                  <span style={styles.photoName}>{photo.filename}</span>
                  <ExternalLink size={12} color="#94a3b8" />
                </div>
              </a>
            ))}
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    backdropFilter: 'blur(6px)',
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
    maxWidth: '820px',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
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
    padding: '14px 16px',
    marginBottom: '14px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
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
    height: '8px',
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
    marginBottom: '14px',
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
    marginBottom: '14px',
  },
  pickerActiveBox: {
    padding: '12px 14px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    borderRadius: '10px',
    marginBottom: '14px',
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
  },
  photoCount: {
    fontSize: '13px',
    color: '#94a3b8',
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
  emptyState: {
    padding: '50px 20px',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
    overflowY: 'auto',
    maxHeight: '52vh',
    paddingRight: '4px',
  },
  photoCard: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0b1120',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    overflow: 'hidden',
    textDecoration: 'none',
    transition: 'transform 0.15s ease, border-color 0.15s ease',
  },
  photoImgWrapper: {
    position: 'relative',
    width: '100%',
    height: '115px',
    backgroundColor: '#1e293b',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  ikTag: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    color: '#ec4899',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 5px',
    borderRadius: '4px',
    border: '1px solid rgba(236, 72, 153, 0.4)',
  },
  photoFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 9px',
    fontSize: '11px',
    color: '#cbd5e1',
    backgroundColor: '#0b1120',
  },
  photoName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100px',
  },
};
