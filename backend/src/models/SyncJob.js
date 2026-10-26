import mongoose from 'mongoose';

/**
 * SyncJob — Persistent record of a background Google data sync.
 * Lives in MongoDB so progress survives browser close and server restart.
 */
const syncJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'syncing', 'completed', 'error', 'partial'],
      default: 'pending',
      index: true,
    },

    // Per-service progress
    contacts: {
      status: { type: String, enum: ['pending', 'syncing', 'done', 'error', 'skipped'], default: 'pending' },
      synced: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      error: { type: String, default: '' },
    },
    gmail: {
      status: { type: String, enum: ['pending', 'syncing', 'done', 'error', 'skipped'], default: 'pending' },
      synced: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      error: { type: String, default: '' },
    },
    drive: {
      status: { type: String, enum: ['pending', 'syncing', 'done', 'error', 'skipped'], default: 'pending' },
      synced: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      error: { type: String, default: '' },
    },
    photos: {
      status: { type: String, enum: ['pending', 'syncing', 'done', 'error', 'skipped'], default: 'pending' },
      synced: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      error: { type: String, default: '' },
    },

    // Overall message shown to frontend
    message: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Only keep the latest job per user (fast lookup)
syncJobSchema.index({ userId: 1, createdAt: -1 });

export const SyncJob = mongoose.model('SyncJob', syncJobSchema);
