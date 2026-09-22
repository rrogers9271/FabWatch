import { QueryClient } from "@tanstack/react-query";

async function getQueryFn({
  queryKey,
}: {
  queryKey: readonly unknown[];
}) {
  const path = String(queryKey[0]);

  const response = await fetch(path, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn,
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
      retry: false,
    },
  },
});

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<any> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}
