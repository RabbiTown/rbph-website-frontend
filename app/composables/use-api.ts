import type { FetchError, FetchOptions } from 'ofetch';
import { createError } from '#app';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

interface ApiResult<T> {
  code: number;
  data: T;
}

interface ApiRequestOptions<TBody = unknown> extends Omit<FetchOptions, 'body' | 'method' | 'query'> {
  path: string;
  method?: HttpMethod;
  body?: TBody;
  query?: FetchOptions['query'];
  errorHints?: Record<number, string>;
}

export function useApi() {
  const config = useRuntimeConfig();

  const buildUrl = (path: string) => (/^https?:/i.test(path) ? path : `${config.public.apiBase ?? ''}${path}`);

  const normalizeResponse = <T>(payload: ApiEnvelope<T> | T, errorHints?: Record<number, string>): ApiResult<T> => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'code' in payload) {
      const envelope = payload as ApiEnvelope<T> & Record<string, unknown>;
      const code = typeof envelope.code === 'number' ? envelope.code : 0;

      if (code < 0) {
        const resolvedMessage = envelope.message ?? errorHints?.[code];
        const statusMessage = resolvedMessage ?? `API error ${code}`;

        throw createError({
          statusCode: 400,
          statusMessage,
          data: {
            code,
            message: resolvedMessage,
            hint: errorHints?.[code],
          },
        });
      }

      const rest = { ...envelope } as Record<string, unknown>;
      delete rest.code;

      return {
        code,
        data: rest as T,
      };
    }

    return {
      code: 0,
      data: payload as T,
    };
  };

  const normalizeBody = (payload: unknown, headers: Headers): FetchOptions['body'] | undefined => {
    if (payload == null) {
      return undefined;
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (payload instanceof FormData || payload instanceof URLSearchParams || payload instanceof Blob || payload instanceof ArrayBuffer || payload instanceof ReadableStream) {
      return payload;
    }

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return JSON.stringify(payload);
  };

  const request = async <TResponse, TBody = unknown>({ path, method = 'GET', body, query, errorHints, credentials, headers, ...rest }: ApiRequestOptions<TBody>): Promise<ApiResult<TResponse>> => {
    const resolvedHeaders = new Headers(headers ?? undefined);
    try {
      const data = await $fetch<ApiEnvelope<TResponse> | TResponse>(buildUrl(path), {
        method,
        body: normalizeBody(body, resolvedHeaders),
        query,
        credentials: credentials ?? 'include',
        headers: resolvedHeaders,
        ...rest,
      });

      return normalizeResponse<TResponse>(data, errorHints);
    } catch (error) {
      const fetchError = error as FetchError<ApiEnvelope<TResponse> | TResponse>;

      if (fetchError?.data !== undefined) {
        const payload = fetchError.data;

        if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'code' in payload) {
          const envelope = payload as ApiEnvelope<TResponse> & Record<string, unknown>;
          const code = typeof envelope.code === 'number' ? envelope.code : 0;
          const resolvedMessage = envelope.message ?? errorHints?.[code];
          const statusMessage = resolvedMessage ?? fetchError.message;

          throw createError({
            statusCode: fetchError.response?.status ?? 400,
            statusMessage,
            data: {
              code,
              message: resolvedMessage,
              hint: errorHints?.[code],
              payload: envelope.data,
            },
          });
        }

        throw createError({
          statusCode: fetchError.response?.status ?? 400,
          statusMessage: (payload as { message?: string }).message ?? fetchError.message,
          data: payload,
        });
      }

      throw error;
    }
  };

  return {
    request,
    get: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'path' | 'method' | 'body'>) => request<TResponse>({ path, method: 'GET', ...options }),
    post: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, 'path' | 'method' | 'body'>) => request<TResponse, TBody>({ path, method: 'POST', body, ...options }),
    put: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, 'path' | 'method' | 'body'>) => request<TResponse, TBody>({ path, method: 'PUT', body, ...options }),
    patch: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, 'path' | 'method' | 'body'>) => request<TResponse, TBody>({ path, method: 'PATCH', body, ...options }),
    del: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'path' | 'method' | 'body'>) => request<TResponse>({ path, method: 'DELETE', ...options }),
  };
}
