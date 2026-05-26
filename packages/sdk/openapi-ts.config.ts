import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../openapi.json',
  output: {
    path: 'src/gen',
  },
  plugins: ['@hey-api/typescript'],
});
