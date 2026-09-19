import { useEffect, useState } from "react";

// No debounce utility exists yet in this project — this is a small, local
// one. Search input updates local state immediately (so typing feels
// responsive); only the value used to actually trigger the API request is
// debounced, avoiding a request per keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
