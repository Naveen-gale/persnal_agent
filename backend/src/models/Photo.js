import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    googlePhotoId: {
      type: String,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      default: 'photo.jpg',
    },
    mimeType: {
      type: String,
      default: 'image/jpeg',
    },
    imageKitFileId: {
      type: String,
      required: true,
    },
    imageKitUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    creationTime: {
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

photoSchema.index({ userId: 1, googlePhotoId: 1 }, { unique: true });

export const Photo = mongoose.model('Photo', photoSchema);
