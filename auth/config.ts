export const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiration: '15m',
    refreshTokenExpiration: '7d',
    algorithm: 'HS256' as const,
    issuer: 'your-app-name',
    audience: 'your-app-name',
  },
  password: {
    saltRounds: 12,
    minLength: 8,
    requireNumbers: true,
    requireSymbols: true,
    requireUppercase: true,
    requireLowercase: true
  },
  refreshToken: {
    length: 40,
    cookieName: 'refresh_token',
    cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/auth/refresh'
    }
  }
};
