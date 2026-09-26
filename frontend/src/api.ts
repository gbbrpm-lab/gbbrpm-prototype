import type {
  DatasetPayload,
  DatasetSummary,
  EvaluationResponse,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listDatasets: () => request<DatasetSummary[]>("/datasets"),
  getDataset: (id: string) => request<DatasetPayload>(`/datasets/${id}`),
  validateDataset: (dataset: DatasetPayload) =>
    request("/datasets/validate", {
      method: "POST",
      body: JSON.stringify(dataset),
    }),
  evaluate: (dataset: DatasetPayload) =>
    request<EvaluationResponse>("/evaluate", {
      method: "POST",
      body: JSON.stringify(dataset),
    }),
};
