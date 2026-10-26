import mongoose from 'mongoose';

const driveFileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    driveFileId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      default: 'Untitled File',
      trim: true,
      index: true,
    },
    mimeType: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: null,
    },
    webViewLink: {
      type: String,
      default: '',
    },
    thumbnailLink: {
      type: String,
      default: '',
    },
    createdTime: {
      type: Date,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

driveFileSchema.index({ userId: 1, driveFileId: 1 }, { unique: true });

export const DriveFile = mongoose.model('DriveFile', driveFileSchema);
