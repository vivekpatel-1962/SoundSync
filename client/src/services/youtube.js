import { api } from './api.js';

// YouTube service helper
// Uses internal proxy endpoints to keep the API key server-side.
export const youtube = {
  // Search for videos by query string
  search: async (q) => {
    const res = await api.get(`/yt/search?q=${encodeURIComponent(q)}`);
    return res.items || [];
  },
  // Fetch details for one or more video IDs
  videos: async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const res = await api.get(`/yt/videos?ids=${encodeURIComponent(list.join(','))}`);
    return res.items || [];
  }
};
