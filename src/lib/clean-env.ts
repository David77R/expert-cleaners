export function cleanEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  const unquoted = /^(["'`])[\s\S]*\1$/.test(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
  return unquoted;
}

export function cleanSupabaseUrl(value: string | undefined): string | undefined {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return cleaned;
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned;
  }
}
