import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonFileStore {
  constructor({ filePath = '' } = {}) {
    this.filePath = filePath;
  }

  async load() {
    if (!this.filePath) return null;
    try {
      const payload = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(payload);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(state) {
    if (!this.filePath) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const serializable = {
      nodes: state.nodes,
      edges: state.edges,
      logs: state.logs,
      memoryInsights: state.memoryInsights,
      memoryVersions: state.memoryVersions,
      sessions: state.sessions
    };
    await fs.writeFile(this.filePath, JSON.stringify(serializable, null, 2));
  }
}
