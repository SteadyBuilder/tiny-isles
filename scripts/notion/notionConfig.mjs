// @ts-check

export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';
export const NOTION_MAX_TEXT_LENGTH = 1900;
export const NOTION_MAX_BLOCKS_PER_REQUEST = 100;

/** @type {Record<string, string>} */
export const CATEGORY_ALIASES = {
  docs: '📝 기획/문서 (Docs)',
  기획: '📝 기획/문서 (Docs)',
  문서: '📝 기획/문서 (Docs)',
  chore: '⚙️ 세팅 (Chore)',
  세팅: '⚙️ 세팅 (Chore)',
  feat: '✨ 기능 (Feat)',
  기능: '✨ 기능 (Feat)',
  design: '🎨 UI/UX (Design)',
  ui: '🎨 UI/UX (Design)',
  ux: '🎨 UI/UX (Design)',
  fix: '🐛 버그 (Fix)',
  버그: '🐛 버그 (Fix)',
  refactor: '♻️ 리팩토링 (Refactor)',
  리팩토링: '♻️ 리팩토링 (Refactor)',
  data: '💾 데이터 (Data)',
  데이터: '💾 데이터 (Data)',
  system: '시스템',
  시스템: '시스템',
  improve: '기능개선',
  기능개선: '기능개선',
  check: '점검',
  점검: '점검',
};

export const DEFAULT_STATUS = '완료';
export const DEFAULT_CATEGORY = '⚙️ 세팅 (Chore)';

/**
 * Resolves a user-provided category string or alias to the exact Notion select option.
 * @param {string | undefined} rawCategory
 * @returns {string}
 */
export function resolveCategory(rawCategory) {
  if (!rawCategory) return DEFAULT_CATEGORY;
  const trimmed = rawCategory.trim();
  const lower = trimmed.toLowerCase();
  return CATEGORY_ALIASES[lower] ?? trimmed;
}
