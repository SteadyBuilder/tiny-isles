// @ts-check
import { NOTION_MAX_TEXT_LENGTH } from './notionConfig.mjs';

/**
 * Splits long text into chunks within Notion's rich_text character limit.
 * @param {string} text
 * @param {number} [maxLen]
 * @returns {string[]}
 */
export function splitTextChunks(text, maxLen = NOTION_MAX_TEXT_LENGTH) {
  if (!text) return [''];
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}

/**
 * @param {string} content
 * @returns {Array<{ type: 'text'; text: { content: string } }>}
 */
function toRichText(content) {
  return splitTextChunks(content).map((chunk) => ({
    type: 'text',
    text: { content: chunk },
  }));
}

/**
 * @param {string} text
 */
function paragraphBlock(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: toRichText(text) },
  };
}

/**
 * @param {string} text
 */
function heading2Block(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: toRichText(text) },
  };
}

/**
 * @param {string} text
 * @param {string} emoji
 */
function calloutBlock(text, emoji) {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji },
      rich_text: toRichText(text),
    },
  };
}

/**
 * Builds Notion page body blocks from task metadata and optional parsed transcript entries.
 * @param {{
 *   prompt?: string;
 *   summary?: string;
 *   commitSha?: string;
 *   transcriptEntries?: Array<{ role: 'USER' | 'AI'; timestamp: string; text: string }>;
 * }} payload
 */
export function buildTaskBlocks({ prompt, summary, commitSha, transcriptEntries = [] }) {
  /** @type {Array<Record<string, unknown>>} */
  const blocks = [];

  if (prompt) {
    blocks.push(heading2Block('💬 작업 요청 (Prompt)'));
    blocks.push(calloutBlock(prompt, '📝'));
  }

  if (summary) {
    blocks.push(heading2Block('✅ 작업 및 점검 결과 (Summary)'));
    const lines = summary.split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
      blocks.push(paragraphBlock(line));
    }
  }

  if (commitSha) {
    blocks.push(heading2Block('🔗 Git 커밋 정보'));
    blocks.push(paragraphBlock(`Commit: ${commitSha}`));
  }

  if (transcriptEntries.length > 0) {
    const toggleChildren = [];
    for (const entry of transcriptEntries) {
      const label = entry.role === 'USER' ? '👤 사용자 요청' : '🤖 AI 응답';
      toggleChildren.push(paragraphBlock(`[${label}] ${entry.text}`));
    }

    blocks.push({
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: toRichText(`📜 전체 대화 원문 (${transcriptEntries.length}개 메시지)`),
        children: toggleChildren.slice(0, 95),
      },
    });
  }

  return blocks;
}
