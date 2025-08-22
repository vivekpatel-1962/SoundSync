import mongoose from 'mongoose';

const VoteSchema = new mongoose.Schema(
  {
    up: { type: [String], default: [] },
    down: { type: [String], default: [] }
  },
  { _id: false }
);

const MetaSchema = new mongoose.Schema(
  {
    title: { type: String },
    subtitle: { type: String },
    cover: { type: String }
  },
  { _id: false }
);

const QueueItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g., 'yt:VIDEO_ID' or 'sample:s1'
    type: { type: String, enum: ['yt', 'sample'], required: true },
    meta: { type: MetaSchema, default: undefined },
    songId: { type: String }, // for sample songs
    ytId: { type: String },   // for YouTube
    votes: { type: VoteSchema, default: () => ({ up: [], down: [] }) }
  },
  { _id: false }
);

const ThemeSchema = new mongoose.Schema(
  {
    primary: { type: String },
    accent: { type: String }
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    // Stable external id used by the API and client (not Mongo _id)
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'New Room' },
    members: { type: [String], default: [] },
    queue: { type: [QueueItemSchema], default: [] },
    theme: { type: ThemeSchema, default: () => ({ primary: '#16a34a', accent: '#f59e0b' }) },
    isPairMode: { type: Boolean, default: false },
    pair: { type: [String], default: [] },
    isPublic: { type: Boolean, default: true },
    joinCode: { type: String, default: null, index: true, sparse: true }
  },
  { timestamps: true }
);

export const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
