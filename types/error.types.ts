export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN'
} as const;
