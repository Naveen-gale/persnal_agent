import axios from 'axios';
import { Contact } from '../models/Contact.js';
import { Email } from '../models/Email.js';
import { DriveFile } from '../models/DriveFile.js';
import { SyncJob } from '../models/SyncJob.js';

// ---------------------------------------------------------------------------
// Helpers — small delays and rate-limit recovery to protect Render free tier
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrapper around axios.get that auto-retries once on 429 (rate-limit) after
 * a 5-second pause. Keeps the sync alive instead of crashing.
 */
async function safeFetch(url, opts, retries = 1) {
  try {
    return await axios.get(url, opts);
  } catch (err) {
    if (err.response?.status === 429 && retries > 0) {
      console.warn(`[Rate Limit] 429 hit on ${url} — pausing 5 s then retrying…`);
      await sleep(5000);
      return safeFetch(url, opts, retries - 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. CONTACTS  (batch = 1 Google page of 100, delay 200 ms between pages)
// ---------------------------------------------------------------------------
export async function syncGoogleContactsToMongoDB(user, accessToken, userEmail, syncJob = null) {
  const effectiveEmail = userEmail || user.googleIntegration?.email || user.email;
  const userId = user._id;
  let pageToken = null;
  let syncedCount = 0;

  if (syncJob) {
    syncJob.contacts.status = 'syncing';
    await syncJob.save();
  }

  console.log(`[Contacts Sync] Starting for ${effectiveEmail}…`);

  try {
    do {
      const params = {
        personFields: 'names,phoneNumbers,emailAddresses,metadata',
        pageSize: 100,
      };
      if (pageToken) params.pageToken = pageToken;

      const res = await safeFetch(
        'https://people.googleapis.com/v1/people/me/connections',
        { headers: { Authorization: `Bearer ${accessToken}` }, params, timeout: 15000 }
      );

      const connections = res.data?.connections || [];

      for (const person of connections) {
        const googleContactId = person.resourceName || person.metadata?.sources?.[0]?.id;
        if (!googleContactId) continue;

        await Contact.findOneAndUpdate(
          { userId, googleContactId },
          {
            userId,
            userEmail: effectiveEmail,
            googleContactId,
            name: person.names?.[0]?.displayName || 'Unnamed Contact',
            phone: person.phoneNumbers?.[0]?.value || '',
            email: person.emailAddresses?.[0]?.value || '',
            etag: person.etag || '',
            syncedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        syncedCount++;
      }

      // Update SyncJob progress after each page
      if (syncJob) {
        syncJob.contacts.synced = syncedCount;
        syncJob.contacts.total = syncedCount; // contacts total isn't known up-front
        await syncJob.save();
      }

      pageToken = res.data?.nextPageToken || null;

      // Gentle pause between pages
      if (pageToken) await sleep(200);
    } while (pageToken);

    if (syncJob) {
      syncJob.contacts.status = 'done';
      syncJob.contacts.synced = syncedCount;
      syncJob.contacts.total = syncedCount;
      await syncJob.save();
    }

    console.log(`[Contacts Sync] Done: ${syncedCount} contacts for ${effectiveEmail}`);
    return { syncedCount };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[Contacts Sync Error] ${effectiveEmail}: ${msg}`);
    if (syncJob) {
      syncJob.contacts.status = 'error';
      syncJob.contacts.error = msg;
      await syncJob.save();
    }
    return { syncedCount, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 2. GMAIL  (batch = 10 messages, delay 300 ms between batches)
// ---------------------------------------------------------------------------
const GMAIL_BATCH_SIZE = 10;
const GMAIL_BATCH_DELAY = 300; // ms

export async function syncGmailToMongoDB(user, accessToken, userEmail, maxMessages = 200, syncJob = null) {
  const effectiveEmail = userEmail || user.googleIntegration?.email || user.email;
  const userId = user._id;
  let pageToken = null;
  let syncedCount = 0;
  let totalListed = 0;

  if (syncJob) {
    syncJob.gmail.status = 'syncing';
    await syncJob.save();
  }

  console.log(`[Gmail Sync] Starting for ${effectiveEmail} (max ${maxMessages})…`);

  try {
    while (syncedCount < maxMessages) {
      // Fetch a page of message IDs (max 50 per page from Google)
      const listPageSize = Math.min(50, maxMessages - syncedCount);
      const params = { maxResults: listPageSize, q: 'in:inbox' };
      if (pageToken) params.pageToken = pageToken;

      const listRes = await safeFetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages',
        { headers: { Authorization: `Bearer ${accessToken}` }, params, timeout: 15000 }
      );

      const messageRefs = listRes.data?.messages || [];
      if (messageRefs.length === 0) break;
      totalListed += messageRefs.length;

      // Process in small batches of GMAIL_BATCH_SIZE
      for (let batchStart = 0; batchStart < messageRefs.length; batchStart += GMAIL_BATCH_SIZE) {
        const batch = messageRefs.slice(batchStart, batchStart + GMAIL_BATCH_SIZE);

        for (const msgRef of batch) {
          try {
            const msgRes = await safeFetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
            );

            const data = msgRes.data;
            const headers = data.payload?.headers || [];
            const hdr = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';

            await Email.findOneAndUpdate(
              { userId, googleMessageId: data.id },
              {
                userId,
                userEmail: effectiveEmail,
                googleMessageId: data.id,
                threadId: data.threadId || '',
                subject: hdr('Subject') || '(No Subject)',
                from: hdr('From'),
                to: hdr('To'),
                date: hdr('Date'),
                snippet: data.snippet || '',
                labels: data.labelIds || [],
                syncedAt: new Date(),
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            syncedCount++;
          } catch (msgErr) {
            console.error(`[Gmail Item Error] ${msgRef.id}: ${msgErr.message}`);
          }
        }

        // Update SyncJob progress after each small batch
        if (syncJob) {
          syncJob.gmail.synced = syncedCount;
          syncJob.gmail.total = totalListed;
          await syncJob.save();
        }

        // Pause between batches to keep CPU/RAM flat
        await sleep(GMAIL_BATCH_DELAY);
      }

      pageToken = listRes.data?.nextPageToken || null;
      if (!pageToken) break;
    }

    if (syncJob) {
      syncJob.gmail.status = 'done';
      syncJob.gmail.synced = syncedCount;
      syncJob.gmail.total = totalListed;
      await syncJob.save();
    }

    console.log(`[Gmail Sync] Done: ${syncedCount} emails for ${effectiveEmail}`);
    return { syncedCount };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[Gmail Sync Error] ${effectiveEmail}: ${msg}`);
    if (syncJob) {
      syncJob.gmail.status = 'error';
      syncJob.gmail.error = msg;
      await syncJob.save();
    }
    return { syncedCount, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 3. DRIVE  (batch = 25 files, delay 200 ms between batches)
// ---------------------------------------------------------------------------
const DRIVE_BATCH_SIZE = 25;
const DRIVE_BATCH_DELAY = 200;

export async function syncDriveFilesToMongoDB(user, accessToken, userEmail, maxFiles = 200, syncJob = null) {
  const effectiveEmail = userEmail || user.googleIntegration?.email || user.email;
  const userId = user._id;
  let pageToken = null;
  let syncedCount = 0;

  if (syncJob) {
    syncJob.drive.status = 'syncing';
    await syncJob.save();
  }

  console.log(`[Drive Sync] Starting for ${effectiveEmail} (max ${maxFiles})…`);

  try {
    while (syncedCount < maxFiles) {
      const pageSize = Math.min(100, maxFiles - syncedCount);
      const params = {
        pageSize,
        fields: 'nextPageToken,files(id,name,mimeType,size,webViewLink,thumbnailLink,createdTime)',
        q: 'trashed = false',
        orderBy: 'createdTime desc',
      };
      if (pageToken) params.pageToken = pageToken;

      const res = await safeFetch(
        'https://www.googleapis.com/drive/v3/files',
        { headers: { Authorization: `Bearer ${accessToken}` }, params, timeout: 15000 }
      );

      const files = res.data?.files || [];
      if (files.length === 0) break;

      // Process in small batches
      for (let batchStart = 0; batchStart < files.length; batchStart += DRIVE_BATCH_SIZE) {
        const batch = files.slice(batchStart, batchStart + DRIVE_BATCH_SIZE);

        for (const file of batch) {
          await DriveFile.findOneAndUpdate(
            { userId, driveFileId: file.id },
            {
              userId,
              userEmail: effectiveEmail,
              driveFileId: file.id,
              name: file.name || 'Untitled File',
              mimeType: file.mimeType || '',
              size: file.size ? Number(file.size) : null,
              webViewLink: file.webViewLink || '',
              thumbnailLink: file.thumbnailLink || '',
              createdTime: file.createdTime ? new Date(file.createdTime) : null,
              syncedAt: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          syncedCount++;
        }

        if (syncJob) {
          syncJob.drive.synced = syncedCount;
          syncJob.drive.total = syncedCount;
          await syncJob.save();
        }

        await sleep(DRIVE_BATCH_DELAY);
      }

      pageToken = res.data?.nextPageToken || null;
      if (!pageToken) break;
    }

    if (syncJob) {
      syncJob.drive.status = 'done';
      syncJob.drive.synced = syncedCount;
      syncJob.drive.total = syncedCount;
      await syncJob.save();
    }

    console.log(`[Drive Sync] Done: ${syncedCount} files for ${effectiveEmail}`);
    return { syncedCount };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[Drive Sync Error] ${effectiveEmail}: ${msg}`);
    if (syncJob) {
      syncJob.drive.status = 'error';
      syncJob.drive.error = msg;
      await syncJob.save();
    }
    return { syncedCount, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 4. MASTER COORDINATOR  — runs services SEQUENTIALLY to keep RAM flat
// ---------------------------------------------------------------------------

/**
 * Run the complete background sync pipeline.
 * Each service runs one after the other (not in parallel) to prevent
 * memory spikes on Render free tier.
 *
 * @param {Object} user        Mongoose User document
 * @param {string} accessToken Google OAuth access token
 * @param {string} userEmail   Google account email
 * @param {Object} [syncJob]   Optional SyncJob document for progress tracking
 */
export async function syncAllGoogleDataToMongoDB(user, accessToken, userEmail, syncJob = null) {
  console.log(`[Full Sync] ▶ Starting complete background sync for ${userEmail}…`);

  if (syncJob) {
    syncJob.status = 'syncing';
    syncJob.startedAt = new Date();
    syncJob.message = 'Syncing contacts…';
    await syncJob.save();
  }

  // --- 1. Contacts (lightest) ---
  const contactsResult = await syncGoogleContactsToMongoDB(user, accessToken, userEmail, syncJob);

  if (syncJob) {
    syncJob.message = 'Syncing Gmail inbox…';
    await syncJob.save();
  }

  // --- 2. Gmail (moderate — 10 per batch) ---
  const gmailResult = await syncGmailToMongoDB(user, accessToken, userEmail, 200, syncJob);

  if (syncJob) {
    syncJob.message = 'Syncing Google Drive files…';
    await syncJob.save();
  }

  // --- 3. Drive (moderate — 25 per batch) ---
  const driveResult = await syncDriveFilesToMongoDB(user, accessToken, userEmail, 200, syncJob);

  // --- Finalize ---
  const hasAnyError = contactsResult.error || gmailResult.error || driveResult.error;

  if (syncJob) {
    syncJob.status = hasAnyError ? 'partial' : 'completed';
    syncJob.completedAt = new Date();
    syncJob.message = hasAnyError
      ? `Sync completed with some issues. Contacts: ${contactsResult.syncedCount}, Emails: ${gmailResult.syncedCount}, Drive: ${driveResult.syncedCount}`
      : `All data synced! Contacts: ${contactsResult.syncedCount}, Emails: ${gmailResult.syncedCount}, Drive: ${driveResult.syncedCount}`;
    await syncJob.save();
  }

  console.log(`[Full Sync] ✔ Finished for ${userEmail}: Contacts=${contactsResult.syncedCount} Gmail=${gmailResult.syncedCount} Drive=${driveResult.syncedCount}`);

  return { contacts: contactsResult, gmail: gmailResult, drive: driveResult };
}
