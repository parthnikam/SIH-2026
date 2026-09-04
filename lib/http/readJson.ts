export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.status === 401
        ? "Sign in required."
        : `Server error ${response.status}. Check the terminal running bun run dev.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.status >= 400
        ? `Request failed (${response.status}).`
        : "Server did not return JSON.",
    );
  }
}
