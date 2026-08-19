import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';

/**
 * Tạo PostgresSaver (database-backed checkpointer) cho LangGraph agent.
 * KHÔNG dùng MemorySaver ở production — mất state khi restart.
 * Bảng checkpoints/checkpoint_writes do PostgresSaver tự tạo (setup idempotent).
 *
 * Xử lý SSL: Aiven dùng self-signed cert. `sslmode=require` trong URL khiến pg
 * tự verify cert và bỏ qua `ssl` option — nên strip sslmode khỏi URL rồi dùng
 * `ssl: { rejectUnauthorized: false }` (giống cách Prisma xử lý).
 */
export async function createCheckpointer(): Promise<PostgresSaver> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set — cannot create checkpointer');

  const cleanUrl = url.replace(/(\?|&)sslmode=[^&]*/, '');

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: /sslmode=require|sslmode=verify/.test(url)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const saver = new PostgresSaver(pool);
  await saver.setup();
  return saver;
}
