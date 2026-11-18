import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Publishable key for the public assistant (see utils/tokens.js)
    assistantToken: { type: String, required: true, unique: true, index: true },
    assistantTokenRotatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Never leak secrets when an organization is serialized.
organizationSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), name: this.name, email: this.email, createdAt: this.createdAt };
};

export const Organization = mongoose.model('Organization', organizationSchema);
