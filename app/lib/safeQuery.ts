export async function withTimeout<T>(
  promise: Promise<T>,
  ms = 8000,
  label = "query"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e ?? "unknown error");
}