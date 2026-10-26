import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
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
    googleMessageId: {
      type: String,
      required: true,
      index: true,
    },
    threadId: {
      type: String,
      index: true,
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    from: {
      type: String,
      default: '',
      trim: true,
    },
    to: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: String,
      default: '',
    },
    snippet: {
      type: String,
      default: '',
    },
    labels: [
      {
        type: String,
      },
    ],
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

emailSchema.index({ userId: 1, googleMessageId: 1 }, { unique: true });

export const Email = mongoose.model('Email', emailSchema);
