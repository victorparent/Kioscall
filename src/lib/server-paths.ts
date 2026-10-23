import path from 'node:path';

/**
 * SERVER ONLY. Where the server remembers things (topics, pictures, access checks).
 * Tests point NEWS_STATE_DIR elsewhere so they never touch a running server's memory.
 */
export const STATE_DIR = process.env.NEWS_STATE_DIR ?? path.join(process.cwd(), '.cache');
