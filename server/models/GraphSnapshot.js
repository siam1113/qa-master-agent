import mongoose from 'mongoose';

// GraphSnapshot stores the latest graph state when a MongoDB connection is configured.
const graphSnapshotSchema = new mongoose.Schema(
  {
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    logs: { type: Array, default: [] },
    memoryInsights: { type: Array, default: [] }
  },
  { timestamps: true }
);

export const GraphSnapshot = mongoose.model('GraphSnapshot', graphSnapshotSchema);
