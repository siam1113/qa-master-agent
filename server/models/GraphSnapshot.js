import mongoose from 'mongoose';

const graphSnapshotSchema = new mongoose.Schema(
  {
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    logs: { type: Array, default: [] },
    memoryInsights: { type: Array, default: [] },
    memoryVersions: { type: Array, default: [] },
    sessions: { type: Array, default: [] },
    observability: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const GraphSnapshot = mongoose.model('GraphSnapshot', graphSnapshotSchema);
