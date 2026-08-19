/** Giới hạn an toàn cho agent. */
export const AGENT_LIMITS = {
  /** Số vòng model/tool tối đa. */
  maxModelSteps: 6,
  /** Timeout toàn run (ms). */
  runTimeoutMs: 30_000,
  /** Timeout từng tool (ms). */
  toolTimeoutMs: 10_000,
  /** Giới hạn tool result đưa vào context (chars). */
  maxToolResultChars: 4000,
  /** Số tin tối đa trong history (AiService đã take:40). */
  maxHistoryMessages: 40,
} as const;

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms),
    ),
  ]);
}
