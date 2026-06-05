import axios, { AxiosError } from 'axios';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

let csrfPromise: Promise<void> | null = null;
export async function ensureCsrf(): Promise<void> {
  if (!csrfPromise) {
    csrfPromise = http.get('/sanctum/csrf-cookie').then(() => undefined);
  }
  return csrfPromise;
}

http.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    await ensureCsrf();
  }
  return config;
});

export type ApiError = AxiosError<{ message?: string; errors?: Record<string, string[]> }>;

export function apiErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as ApiError;
  if (err?.response?.data?.errors) {
    return Object.values(err.response.data.errors).flat().join(' ');
  }
  return err?.response?.data?.message || err?.message || fallback;
}
