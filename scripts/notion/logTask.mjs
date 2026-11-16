// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_STATUS, resolveCategory } from './notionConfig.mjs';
import { buildTaskBlocks } from './notionBlocks.mjs';
import { createTaskPage } from './notionClient.mjs';
import { parseTranscriptFile, resolveTranscriptPath } from './transcriptParser.mjs';

/**
 * Loads key=value pairs from .env.local or .env without external dependencies.
 * @param {string} cwd
 */
function loadEnvFiles(cwd) {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Parses CLI arguments in --key value format.
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

async function main() {
  loadEnvFiles(process.cwd());
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!apiKey || !databaseId) {
    console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID must be set in .env.local or env.');
    process.exit(1);
  }

  const title = args.title;
  if (!title) {
    console.error('Error: --title is required.');
    process.exit(1);
  }

  const category = resolveCategory(args.category);
  const status = args.status ?? DEFAULT_STATUS;
  const prompt = args.prompt ?? '';
  const summary = args.summary ?? '';
  const commitSha = args.commit ?? '';

  const transcriptPath = resolveTranscriptPath({
    transcriptPath: args.transcript,
    conversationId: args['conversation-id'],
  });
  const transcriptEntries = transcriptPath ? parseTranscriptFile(transcriptPath) : [];

  const children = buildTaskBlocks({
    prompt,
    summary,
    commitSha,
    transcriptEntries,
  });

  const page = await createTaskPage({
    apiKey,
    databaseId,
    title,
    category,
    status,
    children,
  });

  console.log(`Notion page created: ${page.url}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
