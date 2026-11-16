import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: './openapi.json',
    output: {
      mode: 'split',
      target: 'src/api/generated/api.ts',
      schemas: 'src/api/generated/model',
      client: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/api/http.ts', name: 'http' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  zod: {
    input: './openapi.json',
    output: {
      target: 'src/api/generated/zod.ts',
      client: 'zod',
    },
  },
})
