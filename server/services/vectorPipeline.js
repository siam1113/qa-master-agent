import { createHash } from 'node:crypto';

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'then', 'must', 'should']);

export class VectorPipeline {
  constructor({ dimensions = 64 } = {}) {
    this.dimensions = dimensions;
  }

  chunkKnowledge(text = '', { maxChars = 420 } = {}) {
    const paragraphs = text.split(/\n{2,}|(?<=\.)\s+/).map((item) => item.trim()).filter(Boolean);
    const chunks = [];
    let buffer = '';
    for (const paragraph of paragraphs) {
      if ((buffer + ' ' + paragraph).trim().length > maxChars && buffer) {
        chunks.push(buffer.trim());
        buffer = paragraph;
      } else {
        buffer = `${buffer} ${paragraph}`.trim();
      }
    }
    if (buffer) chunks.push(buffer.trim());
    return chunks.length ? chunks : [text.trim()].filter(Boolean);
  }

  embed(text = '') {
    const vector = new Array(this.dimensions).fill(0);
    for (const token of this.tokenize(text)) {
      const digest = createHash('sha256').update(token).digest();
      const index = digest[0] % this.dimensions;
      vector[index] += 1 + (digest[1] / 255);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
  }

  similarity(a = [], b = []) {
    const length = Math.min(a.length, b.length);
    let score = 0;
    for (let index = 0; index < length; index += 1) score += a[index] * b[index];
    return Number(score.toFixed(6));
  }

  tokenize(text = '') {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  }
}

export const vectorPipeline = new VectorPipeline();
