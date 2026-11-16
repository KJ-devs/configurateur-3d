const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5080'

export class ApiError extends Error {
  readonly status: number
  readonly problem: unknown

  constructor(status: number, problem: unknown) {
    super(`API error ${status}`)
    this.status = status
    this.problem = problem
  }
}

export const resolveApiUrl = (path: string): string => `${API_URL}${path}`

/** Fetch wrapper used by the generated client: resolves the base URL and throws on HTTP errors. */
export const http = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(resolveApiUrl(url), options)
  const hasBody = response.status !== 204 && response.headers.get('content-length') !== '0'
  const body: unknown = hasBody ? await response.json() : undefined

  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}
