// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * @typedef {Object} TranscriptEntry
 * @property {'USER' | 'AI'} role
 * @property {string} timestamp
 * @property {string} text
 */

/**
 * Resolves the transcript.jsonl path from an explicit path or conversation ID.
 * @param {{ transcriptPath?: string; conversationId?: string }} options
 * @returns {string | null}
 */
export function resolveTranscriptPath({ transcriptPath, conversationId }) {
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    return transcriptPath;
  }
  if (!conversationId) return null;

  const cleanId = conversationId.trim();
  const candidates = [
    path.join(os.homedir(), '.gemini', 'jetski', 'brain', cleanId, '.system_generated', 'logs', 'transcript.jsonl'),
    path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cleanId, '.system_generated', 'logs', 'transcript.jsonl'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Reads and parses user prompts and AI responses from transcript.jsonl without using LLM tokens.
 * @param {string} filePath
 * @returns {TranscriptEntry[]}
 */
export function parseTranscriptFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  /** @type {TranscriptEntry[]} */
  const entries = [];

  for (const line of lines) {
    try {
      const step = JSON.parse(line);
      if (step.type === 'USER_INPUT' && typeof step.content === 'string' && step.content.trim()) {
        entries.push({
          role: 'USER',
          timestamp: step.created_at ?? '',
          text: step.content.trim(),
        });
      } else if (
        step.type === 'PLANNER_RESPONSE' &&
        typeof step.content === 'string' &&
        step.content.trim()
      ) {
        entries.push({
          role: 'AI',
          timestamp: step.created_at ?? '',
          text: step.content.trim(),
        });
      }
    } catch {
      // Skip malformed JSONL lines safely
    }
  }

  return entries;
}
