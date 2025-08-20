import mongoose from 'mongoose';

const TrackSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String },
    channel: { type: String }
  },
  { _id: false }
);

const UserYTSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    likes: { type: [String], default: [] },
    playlists: {
      type: Map,
      of: [TrackSchema],
      default: () => new Map()
    }
  },
  { timestamps: true }
);

export const UserYT = mongoose.models.UserYT || mongoose.model('UserYT', UserYTSchema);

export async function getOrCreateUserYT(userId) {
  if (!userId) throw new Error('Missing userId');
  let doc = await UserYT.findOne({ userId });
  if (!doc) {
    doc = await UserYT.create({ userId, likes: [], playlists: new Map() });
  }
  return doc;
}
