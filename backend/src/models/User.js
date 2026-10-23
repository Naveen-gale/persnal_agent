import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const googleIntegrationSchema = new mongoose.Schema(
  {
    connected: { type: Boolean, default: false },
    encryptedData: { type: String, default: '' },
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    scopes: [{ type: String }],
    email: { type: String, default: '' },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    googleIntegration: {
      type: googleIntegrationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Method to set password with bcrypt hash (cost factor 10)
userSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

// Method to validate password against hash
userSchema.methods.validatePassword = async function (password) {
  if (!this.passwordHash || !password) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// Safe user profile representation (never outputs password or sensitive token data)
userSchema.methods.toProfileJSON = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    role: this.role,
    googleIntegration: {
      connected: Boolean(this.googleIntegration?.connected),
      email: this.googleIntegration?.email || '',
      scopes: this.googleIntegration?.scopes || [],
      connectedAt: this.googleIntegration?.connectedAt || null,
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);
