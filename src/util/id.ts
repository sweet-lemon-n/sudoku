/** 浏览器里的随机 id；没有 crypto.randomUUID 时退回时间戳 + 随机串。 */
export function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
