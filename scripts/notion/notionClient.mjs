// @ts-check
import {
  NOTION_API_BASE,
  NOTION_MAX_BLOCKS_PER_REQUEST,
  NOTION_VERSION,
} from './notionConfig.mjs';

/**
 * @param {string} endpoint
 * @param {string} apiKey
 * @param {'GET' | 'POST' | 'PATCH'} method
 * @param {unknown} [body]
 */
async function notionRequest(endpoint, apiKey, method, body) {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Notion API Error (${response.status}): ${data.message ?? JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Appends blocks in chunks respecting Notion's 100-block limit per request.
 * @param {string} pageId
 * @param {string} apiKey
 * @param {Array<Record<string, unknown>>} blocks
 */
async function appendRemainingBlocks(pageId, apiKey, blocks) {
  for (let i = 0; i < blocks.length; i += NOTION_MAX_BLOCKS_PER_REQUEST) {
    const chunk = blocks.slice(i, i + NOTION_MAX_BLOCKS_PER_REQUEST);
    await notionRequest(`/blocks/${pageId}/children`, apiKey, 'PATCH', { children: chunk });
  }
}

/**
 * Creates a new task page in the Notion database.
 * @param {{
 *   apiKey: string;
 *   databaseId: string;
 *   title: string;
 *   category: string;
 *   status: string;
 *   dateIso?: string;
 *   children?: Array<Record<string, unknown>>;
 * }} params
 */
export async function createTaskPage({
  apiKey,
  databaseId,
  title,
  category,
  status,
  dateIso,
  children = [],
}) {
  const initialBlocks = children.slice(0, NOTION_MAX_BLOCKS_PER_REQUEST);
  const remainingBlocks = children.slice(NOTION_MAX_BLOCKS_PER_REQUEST);

  const properties = {
    이름: {
      title: [{ text: { content: title } }],
    },
    구분: {
      select: { name: category },
    },
    상태: {
      select: { name: status },
    },
    처리일자: {
      date: { start: dateIso ?? new Date().toISOString().slice(0, 10) },
    },
  };

  const created = await notionRequest('/pages', apiKey, 'POST', {
    parent: { database_id: databaseId },
    properties,
    children: initialBlocks,
  });

  if (remainingBlocks.length > 0) {
    await appendRemainingBlocks(created.id, apiKey, remainingBlocks);
  }

  return created;
}
