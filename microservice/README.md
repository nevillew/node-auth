# Tenant Data Access Microservice

A secure microservice that validates auth tokens and manages tenant data access with Redis caching.

## Features

### Core Functionality
- Token validation via introspection endpoint
- Tenant database connection pooling
- Redis caching for performance
- Comprehensive health monitoring

### Security
- Token validation and caching
- Rate limiting
- Request validation
- Error handling
- Security headers
- Audit logging

### Performance
- Connection pooling
- Redis caching
- Request throttling
- Fallback caching

## Prerequisites

- Node.js 18+
- Redis 6+
- PostgreSQL 14+

## Installation

1. Clone and install:
```bash
git clone <repository-url>
cd microservice
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start service:
```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

### Required Environment Variables

```
# Server
PORT=3001
NODE_ENV=development

# Auth Service
AUTH_SERVICE_URL=http://localhost:3000
TOKEN_INTROSPECTION_ENDPOINT=/auth/introspect

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379
```

See `.env.example` for all available options.

## API Endpoints

All endpoints require a valid auth token and tenant ID:

```
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

### Health Check
- `GET /health` - Basic health status
- `GET /health/details` - Detailed metrics (authenticated)

### Data Access
- `GET /api/data` - Get tenant data
- `POST /api/data` - Create tenant data
- `PUT /api/data` - Update tenant data
- `DELETE /api/data` - Delete tenant data

## Architecture

### Token Validation
1. Extract token from Authorization header
2. Validate via introspection endpoint
3. Cache validation result in Redis
4. Connect to tenant database

### Caching
- Token validation results (5 min TTL)
- Tenant configurations (1 hour TTL)
- Fallback to in-memory cache if Redis is down

### Database Connections
- Connection pooling per tenant
- Automatic connection cleanup
- Connection health monitoring
- Pool size limits

## Error Handling

Standard error response format:
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "requestId": "uuid"
}
```

Common error codes:
- `AUTHENTICATION_FAILED` - Invalid/expired token
- `TENANT_NOT_FOUND` - Invalid tenant ID
- `DATABASE_ERROR` - Connection/query failed
- `RATE_LIMITED` - Too many requests

## Monitoring

### Health Checks
The `/health` endpoint reports:
- Database connectivity
- Redis connection status
- Memory usage
- Connection pool stats
- Cache hit rates

### Logging
- Request/response logging
- Error tracking
- Performance metrics
- Security events

## Development

### Testing
```bash
npm test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Local Development
1. Start Redis and PostgreSQL
2. Configure .env
3. Run `npm run dev`
4. Test endpoints with Postman/curl

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit PR

## License

MIT

## Support

- GitHub Issues
- Email: support@example.com
