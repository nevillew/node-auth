# Pagination Guide

## Overview
This document details the technical implementation of pagination in the multi-tenant platform, including best practices, query optimization, and response formatting.

## Implementation

### Request Parameters
```typescript
interface PaginationParams {
  page?: number;      // Page number, starting from 1
  limit?: number;     // Items per page
  sortBy?: string;    // Field to sort by
  sortOrder?: 'ASC' | 'DESC';  // Sort direction
}
```

### Query Construction
```javascript
const options = {
  limit: parseInt(limit) || 20,
  offset: ((parseInt(page) || 1) - 1) * (parseInt(limit) || 20),
  order: [[sortBy || 'createdAt', sortOrder || 'DESC']]
};
```

### Response Format
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
    limit: number;
  }
}
```

## Implementation Examples

### Database Query
```javascript
const results = await Model.findAndCountAll({
  where,
  ...options,
  include: [{
    model: RelatedModel,
    attributes: ['id', 'name']
  }]
});

return {
  data: results.rows,
  pagination: {
    total: results.count,
    page: parseInt(page) || 1,
    totalPages: Math.ceil(results.count / limit),
    hasMore: (page * limit) < results.count,
    limit: parseInt(limit) || 20
  }
};
```

### Cache Management
```javascript
const cacheKey = `${resource}:${page}:${limit}:${sortBy}:${sortOrder}`;
const cacheTTL = 300; // 5 minutes

// Get from cache or database
const results = await redisClient.get(cacheKey) || 
  await fetchFromDatabase(options);

// Update cache
await redisClient.set(cacheKey, results, 'EX', cacheTTL);
```

## Query Optimization

### Index Usage
```sql
-- Create indexes for commonly sorted fields
CREATE INDEX idx_created_at ON table_name (created_at DESC);
CREATE INDEX idx_updated_at ON table_name (updated_at DESC);
```

### Efficient Counting
```javascript
// For large tables, estimate count
const approximateCount = await Model.count({
  where,
  limit: 10000  // Stop counting after threshold
});
```

### Cursor-based Pagination
```javascript
interface CursorParams {
  cursor?: string;  // Base64 encoded last ID
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

// Query using cursor
const where = cursor ? {
  id: { [Op.gt]: decodeCursor(cursor) }
} : {};

const results = await Model.findAll({
  where,
  limit: limit + 1,  // Fetch one extra to determine hasMore
  order: [['id', sortOrder]]
});

const hasMore = results.length > limit;
const items = results.slice(0, limit);
const nextCursor = hasMore ? encodeCursor(items[items.length - 1].id) : null;
```

## Performance Considerations

### Query Limits
```javascript
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function validatePaginationParams(params) {
  return {
    limit: Math.min(
      parseInt(params.limit) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    ),
    page: Math.max(parseInt(params.page) || 1, 1)
  };
}
```

### Resource Protection
```javascript
const paginationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many pagination requests'
});
```

## API Examples

### List Users
```http
GET /api/users?page=2&limit=20&sortBy=createdAt&sortOrder=DESC
Authorization: Bearer <token>
```

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "User Name",
      "email": "user@example.com",
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 2,
    "totalPages": 8,
    "hasMore": true,
    "limit": 20
  }
}
```

## Client Implementation

### TypeScript SDK
```typescript
class PaginatedResource<T> {
  async list(params: PaginationParams): Promise<PaginatedResponse<T>> {
    const queryString = new URLSearchParams({
      page: params.page?.toString() || '1',
      limit: params.limit?.toString() || '20',
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'DESC'
    }).toString();

    return this.client.get(`/${this.path}?${queryString}`);
  }
}
```

### React Hook Example
```typescript
function usePagination<T>(
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  params: PaginationParams
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 0,
    hasMore: false
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const response = await fetchFn(params);
        setData(response.data);
        setPagination(response.pagination);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [params]);

  return { data, loading, error, pagination };
}
```

## Best Practices

### Performance
1. Use appropriate indexes
2. Implement caching
3. Validate input params
4. Set reasonable limits

### User Experience
1. Consistent page sizes
2. Clear navigation
3. Loading states
4. Error handling

### Security
1. Rate limiting
2. Input validation
3. Resource protection
4. Access control

### Monitoring
1. Track response times
2. Monitor cache hits
3. Log errors
4. Collect metrics

## Related Documentation
- Query Optimization Guide
- Cache Management Guide
- API Best Practices
- Performance Monitoring
