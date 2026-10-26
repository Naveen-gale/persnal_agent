import ImageKit from 'imagekit';
import axios from 'axios';
import { config } from '../config/env.js';
import { Photo } from '../models/Photo.js';

let imagekitInstance = null;

export function getImageKitClient() {
  if (!imagekitInstance) {
    if (!config.imagekitPublicKey || !config.imagekitPrivateKey || !config.imagekitUrlEndpoint) {
      console.warn('[ImageKit Warning] ImageKit credentials are not fully configured in backend .env');
      return null;
    }
    imagekitInstance = new ImageKit({
      publicKey: config.imagekitPublicKey,
      privateKey: config.imagekitPrivateKey,
      urlEndpoint: config.imagekitUrlEndpoint,
    });
  }
  return imagekitInstance;
}

// In-memory sync progress map per userId
// Format: { status: 'idle'|'syncing'|'completed'|'error', phase: string, current: number, total: number, percent: number, message: string }
const syncProgressMap = new Map();

export function getSyncProgress(userId) {
  const key = userId.toString();
  return (
    syncProgressMap.get(key) || {
      status: 'idle',
      phase: '',
      current: 0,
      total: 0,
      percent: 0,
      message: 'No active synchronization.',
    }
  );
}

export function updateSyncProgress(userId, progressData) {
  const key = userId.toString();
  const current = syncProgressMap.get(key) || {};
  const updated = { ...current, ...progressData, updatedAt: new Date() };
  syncProgressMap.set(key, updated);
  return updated;
}

/**
 * Upload an image buffer or URL directly to ImageKit.
 */
export async function uploadToImageKit({ file, fileName, userId, tags = [] }) {
  const imagekit = getImageKitClient();
  if (!imagekit) {
    throw new Error('ImageKit is not configured. Check IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_URL_ENDPOINT.');
  }

  return await imagekit.upload({
    file,
    fileName,
    folder: `/google_photos/${userId}`,
    tags: ['synced-agent', ...tags],
    useUniqueFileName: true,
  });
}

/**
 * Step 1 for Google Photos Picker: Create an official picking session.
 * Returns { sessionId, pickerUri }
 */
export async function createPhotosPickerSession(accessToken) {
  if (!accessToken) {
    throw new Error('Google OAuth access token is required to create a Photos Picker session.');
  }

  const res = await axios.post(
    'https://photospicker.googleapis.com/v1/sessions',
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  return {
    sessionId: res.data.id,
    pickerUri: res.data.pickerUri,
  };
}

/**
 * Step 2 for Google Photos Picker: Fetch picked media items and upload each to ImageKit with live progress.
 */
export async function syncPickerSessionToImageKit(user, accessToken, sessionId) {
  const userId = user._id.toString();
  updateSyncProgress(userId, {
    status: 'syncing',
    phase: 'Retrieving selected photos from Google...',
    current: 0,
    total: 0,
    percent: 5,
    message: 'Connecting to Google Photos Picker...',
  });

  try {
    const res = await axios.get(`https://photospicker.googleapis.com/v1/mediaItems`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        sessionId,
        pageSize: 50,
      },
      timeout: 15000,
    });

    const items = res.data?.mediaItems || [];
    if (items.length === 0) {
      updateSyncProgress(userId, {
        status: 'completed',
        phase: 'No items selected.',
        current: 0,
        total: 0,
        percent: 100,
        message: 'No photos were selected in the Google Photos Picker.',
      });
      return { synced: 0, total: 0 };
    }

    const total = items.length;
    let synced = 0;

    for (let i = 0; i < items.length; i++) {
      const itemWrapper = items[i];
      const mediaItem = itemWrapper.mediaItem || itemWrapper;
      const percent = Math.round(((i + 1) / total) * 95);
      const filename = mediaItem.filename || `photo_${mediaItem.id?.slice(0, 8) || i + 1}.jpg`;

      updateSyncProgress(userId, {
        status: 'syncing',
        phase: `Downloading and storing in ImageKit...`,
        current: i + 1,
        total,
        percent,
        message: `Storing photo ${i + 1} of ${total}: "${filename}" in ImageKit`,
      });

      try {
        // Check if already stored
        const existing = await Photo.findOne({
          userId: user._id,
          googlePhotoId: mediaItem.id,
        });

        if (existing) {
          synced++;
          continue;
        }

        // Google Photos requires Bearer token to download media content from baseUrl
        const downloadUrl = `${mediaItem.baseUrl}=d`;
        const photoBufferRes = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 20000,
        });

        // Upload buffer directly to ImageKit
        const uploadRes = await uploadToImageKit({
          file: Buffer.from(photoBufferRes.data),
          fileName: filename,
          userId,
          tags: ['google-photos-picker'],
        });

        // Save in MongoDB
        const photoDoc = new Photo({
          userId: user._id,
          googlePhotoId: mediaItem.id,
          filename,
          mimeType: mediaItem.mimeType || 'image/jpeg',
          imageKitFileId: uploadRes.fileId,
          imageKitUrl: uploadRes.url,
          thumbnailUrl: uploadRes.thumbnailUrl || uploadRes.url,
          width: uploadRes.width || null,
          height: uploadRes.height || null,
          creationTime: mediaItem.mediaMetadata?.creationTime ? new Date(mediaItem.mediaMetadata.creationTime) : null,
          syncedAt: new Date(),
        });

        await photoDoc.save();
        synced++;
      } catch (err) {
        console.error(`[Picker Item Upload Error] Error on item ${mediaItem.id}:`, err.message);
      }
    }

    // Clean up session with Google
    try {
      await axios.delete(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // session cleanup error can be ignored
    }

    updateSyncProgress(userId, {
      status: 'completed',
      phase: 'Completed',
      current: synced,
      total,
      percent: 100,
      message: `Successfully stored ${synced} of ${total} photos in ImageKit!`,
    });

    return { synced, total };
  } catch (err) {
    updateSyncProgress(userId, {
      status: 'error',
      phase: 'Failed',
      current: 0,
      total: 0,
      percent: 0,
      message: `Sync failed: ${err.response?.data?.error?.message || err.message}`,
    });
    throw err;
  }
}

/**
 * Sync photos from Google Drive into ImageKit with real-time progress.
 * Supports complete pagination to store ALL photos in ImageKit.
 */
export async function syncGoogleDrivePhotosToImageKit(user, accessToken, maxPhotos = 500) {
  const userId = user._id.toString();
  updateSyncProgress(userId, {
    status: 'syncing',
    phase: 'Scanning Google Drive for photos...',
    current: 0,
    total: 0,
    percent: 5,
    message: 'Looking for image files in your Google account...',
  });

  try {
    let pageToken = null;
    const allFiles = [];

    // Continuous pagination to retrieve all photos
    do {
      const params = {
        q: "mimeType contains 'image/' and trashed=false",
        fields: 'nextPageToken,files(id, name, mimeType, size, createdTime, imageMediaMetadata)',
        pageSize: 100, // Maximum per page
        orderBy: 'createdTime desc',
      };
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const driveRes = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
        timeout: 15000,
      });

      const batch = driveRes.data?.files || [];
      allFiles.push(...batch);
      pageToken = driveRes.data?.nextPageToken || null;
    } while (pageToken && allFiles.length < maxPhotos);

    if (allFiles.length === 0) {
      updateSyncProgress(userId, {
        status: 'completed',
        phase: 'No photos found in Google Drive.',
        current: 0,
        total: 0,
        percent: 100,
        message: 'No photo files were found in Google Drive.',
      });
      return { synced: 0, total: 0 };
    }

    const total = allFiles.length;
    let synced = 0;

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      const percent = Math.round(((i + 1) / total) * 95);

      updateSyncProgress(userId, {
        status: 'syncing',
        phase: `Downloading and storing in ImageKit...`,
        current: i + 1,
        total,
        percent,
        message: `Storing photo ${i + 1} of ${total}: "${file.name}" in ImageKit`,
      });

      try {
        const existing = await Photo.findOne({
          userId: user._id,
          googlePhotoId: file.id,
        });

        if (existing) {
          synced++;
          continue;
        }

        // Download photo binary buffer from Google Drive
        const downloadRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 25000,
        });

        // Upload buffer directly to ImageKit
        const uploadRes = await uploadToImageKit({
          file: Buffer.from(downloadRes.data),
          fileName: file.name || `drive_photo_${file.id.slice(0, 8)}.jpg`,
          userId,
          tags: ['google-drive-photos'],
        });

        const photoDoc = new Photo({
          userId: user._id,
          googlePhotoId: file.id,
          filename: file.name,
          mimeType: file.mimeType || 'image/jpeg',
          imageKitFileId: uploadRes.fileId,
          imageKitUrl: uploadRes.url,
          thumbnailUrl: uploadRes.thumbnailUrl || uploadRes.url,
          width: uploadRes.width || file.imageMediaMetadata?.width || null,
          height: uploadRes.height || file.imageMediaMetadata?.height || null,
          creationTime: file.createdTime ? new Date(file.createdTime) : null,
          syncedAt: new Date(),
        });

        await photoDoc.save();
        synced++;

        // Gentle delay for free tier CPU/RAM — 500ms every 5 photos, 100ms otherwise
        const delayMs = (synced % 5 === 0) ? 500 : 100;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (fileErr) {
        console.error(`[Drive Photo Error] Error uploading file ${file.id}:`, fileErr.message);
      }
    }

    updateSyncProgress(userId, {
      status: 'completed',
      phase: 'Completed',
      current: synced,
      total,
      percent: 100,
      message: `Successfully stored ${synced} of ${total} Google photos in ImageKit!`,
      requiresReauth: false,
    });

    return { synced, total };
  } catch (err) {
    const isForbidden = err.response?.status === 403;
    updateSyncProgress(userId, {
      status: 'error',
      phase: isForbidden ? 'Permission Required' : 'Failed',
      current: 0,
      total: 0,
      percent: 0,
      message: isForbidden
        ? 'Google Photos/Drive permissions are required. Click "Re-authorize Google" below to grant access, or use "Select from Google Photos".'
        : `Google Drive sync failed: ${err.response?.data?.error?.message || err.message}`,
      requiresReauth: isForbidden,
    });
    throw err;
  }
}

/**
 * Universal photo sync: Tries Google Photos Library API -> Falls back to Google Drive Photos seamlessly.
 * Supports full pagination to sync all user photos.
 */
export async function syncGooglePhotosToImageKit(user, accessToken, maxPhotos = 500) {
  const userId = user._id.toString();

  updateSyncProgress(userId, {
    status: 'syncing',
    phase: 'Checking Google Photos & Drive permissions...',
    current: 0,
    total: 0,
    percent: 5,
    message: 'Starting photo sync to ImageKit...',
    requiresReauth: false,
  });

  // Attempt 1: Try Google Photos Library API (for legacy or app-created data) with pagination
  try {
    let pageToken = null;
    const allMediaItems = [];

    do {
      const params = { pageSize: 100 };
      if (pageToken) params.pageToken = pageToken;

      const photosRes = await axios.get('https://photoslibrary.googleapis.com/v1/mediaItems', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
        timeout: 10000,
      });

      const batch = photosRes.data?.mediaItems || [];
      allMediaItems.push(...batch);
      pageToken = photosRes.data?.nextPageToken || null;
    } while (pageToken && allMediaItems.length < maxPhotos);

    if (allMediaItems.length > 0) {
      let synced = 0;
      const total = allMediaItems.length;

      for (let i = 0; i < allMediaItems.length; i++) {
        const item = allMediaItems[i];
        const percent = Math.round(((i + 1) / total) * 95);
        const filename = item.filename || `photo_${i + 1}.jpg`;

        updateSyncProgress(userId, {
          status: 'syncing',
          phase: 'Uploading to ImageKit...',
          current: i + 1,
          total,
          percent,
          message: `Storing photo ${i + 1} of ${total}: "${filename}" in ImageKit`,
          requiresReauth: false,
        });

        try {
          const existing = await Photo.findOne({ userId: user._id, googlePhotoId: item.id });
          if (existing) {
            synced++;
            continue;
          }

          const bufRes = await axios.get(`${item.baseUrl}=d`, {
            responseType: 'arraybuffer',
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 15000,
          });

          const uploadRes = await uploadToImageKit({
            file: Buffer.from(bufRes.data),
            fileName: filename,
            userId,
            tags: ['google-photos-library'],
          });

          const photoDoc = new Photo({
            userId: user._id,
            googlePhotoId: item.id,
            filename,
            mimeType: item.mimeType || 'image/jpeg',
            imageKitFileId: uploadRes.fileId,
            imageKitUrl: uploadRes.url,
            thumbnailUrl: uploadRes.thumbnailUrl || uploadRes.url,
            width: uploadRes.width || null,
            height: uploadRes.height || null,
            creationTime: item.mediaMetadata?.creationTime ? new Date(item.mediaMetadata.creationTime) : null,
            syncedAt: new Date(),
          });

          await photoDoc.save();
          synced++;

          // Gentle delay for free tier CPU/RAM — 500ms every 5 photos, 100ms otherwise
          const delayMs = (synced % 5 === 0) ? 500 : 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } catch (itemErr) {
          console.error(`[Library Item Error]`, itemErr.message);
        }
      }

      updateSyncProgress(userId, {
        status: 'completed',
        phase: 'Completed',
        current: synced,
        total,
        percent: 100,
        message: `Successfully stored ${synced} Google Photos in ImageKit!`,
        requiresReauth: false,
      });
      return { synced, total };
    }
  } catch (libErr) {
    console.warn(`[Photos Library API notice]: Status ${libErr.response?.status}. Falling back to Google Drive photos.`);
  }

  // Attempt 2: Fallback to Google Drive photos scan (supports all photos)
  try {
    return await syncGoogleDrivePhotosToImageKit(user, accessToken, maxPhotos);
  } catch (driveErr) {
    const isForbidden = driveErr.response?.status === 403;
    updateSyncProgress(userId, {
      status: 'error',
      phase: isForbidden ? 'Permission Required' : 'Sync Error',
      current: 0,
      total: 0,
      percent: 0,
      message: isForbidden
        ? 'Google Photos access requires updated permissions. Please click "Re-authorize Google" below to grant access, or use "Select from Google Photos".'
        : `Photo synchronization error: ${driveErr.message}`,
      requiresReauth: isForbidden,
    });
    throw new Error('Google Photos & Drive permission required. Please click "Re-authorize Google" to grant access.');
  }
}
