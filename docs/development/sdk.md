# SDK Development Guide

## Overview
The SDK provides a TypeScript client for the multi-tenant API.

## Setup
```bash
cd sdk
npm install
npm run build
```

## TypeScript Configuration
From tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "es2018",
    "module": "esnext",
    "declaration": true,
    "strict": true
  }
}
```

## Development Workflow
1. Define types in `src/types.ts`
2. Implement features in `src/index.ts`
3. Write tests in `src/__tests__/`
4. Build SDK
5. Test integration

## Building
```bash
npm run build:sdk
```
Generates:
- ES modules
- Type definitions
- Source maps

## Testing
```bash
npm run test:sdk
```

## Publishing
1. Update version
2. Build SDK
3. Run tests
4. Generate docs
5. Publish to registry

## Integration Example
```typescript
import { MultiTenantSDK } from '@your-org/multitenant-sdk';

const sdk = new MultiTenantSDK({
  baseURL: 'http://localhost:3000',
  token: 'your-token'
});

// Use SDK methods
await sdk.users.create({
  email: 'user@example.com',
  name: 'Test User'
});
```

## Type Definitions
Key types from types.ts:
```typescript
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface CreateUserParams {
  email: string;
  password: string;
  name: string;
}
```
