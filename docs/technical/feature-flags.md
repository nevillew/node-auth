# Feature Flag Documentation

## Overview
This document details the implementation and usage of feature flags in the multi-tenant platform, including configuration, management, and best practices.

## Feature Flag Structure

### Configuration Format
```json
{
  "features": {
    "newDashboard": {
      "enabled": true,
      "description": "New dashboard UI",
      "rolloutPercentage": 100,
      "allowedTenants": ["*"],
      "expiresAt": null
    },
    "betaFeatures": {
      "enabled": false,
      "description": "Beta feature set",
      "rolloutPercentage": 0,
      "allowedTenants": ["tenant-uuid-1", "tenant-uuid-2"],
      "expiresAt": "2025-12-31"
    }
  }
}
```

### Flag Properties
1. **Basic Properties**
   - `enabled`: Boolean master switch
   - `description`: Feature description
   - `rolloutPercentage`: 0-100 rollout control

2. **Access Control**
   - `allowedTenants`: Tenant whitelist
   - `allowedRoles`: Role-based access
   - `expiresAt`: Auto-disable date

## Implementation

### Feature Check
```javascript
const isFeatureEnabled = async (featureKey, context) => {
  const { tenant, user } = context;
  
  // Get feature configuration
  const feature = await getFeatureConfig(featureKey);
  if (!feature) return false;

  // Check master switch
  if (!feature.enabled) return false;

  // Check expiry
  if (feature.expiresAt && new Date() > new Date(feature.expiresAt)) {
    return false;
  }

  // Check tenant access
  if (feature.allowedTenants && 
      !feature.allowedTenants.includes('*') && 
      !feature.allowedTenants.includes(tenant.id)) {
    return false;
  }

  // Check rollout percentage
  const userHash = hashString(`${user.id}:${featureKey}`);
  const userPercentile = userHash % 100;
  if (userPercentile > feature.rolloutPercentage) {
    return false;
  }

  return true;
};
```

### Cache Management
```javascript
// Cache feature configurations
const cacheFeatureConfig = async (featureKey, config) => {
  const cacheKey = `feature:${featureKey}`;
  await redisClient.set(
    cacheKey,
    JSON.stringify(config),
    'EX',
    300 // 5 minutes
  );
};

// Get cached configuration
const getFeatureConfig = async (featureKey) => {
  const cacheKey = `feature:${featureKey}`;
  const cached = await redisClient.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const config = await loadFeatureConfig(featureKey);
  await cacheFeatureConfig(featureKey, config);
  return config;
};
```

## Usage Examples

### Backend Usage
```javascript
// Route middleware
const requireFeature = (featureKey) => async (req, res, next) => {
  const enabled = await isFeatureEnabled(featureKey, {
    tenant: req.tenant,
    user: req.user
  });
  
  if (!enabled) {
    return res.status(404).json({
      error: 'Feature not available'
    });
  }
  
  next();
};

// Route definition
router.get('/new-dashboard',
  requireFeature('newDashboard'),
  dashboardController.getNew
);
```

### Frontend Usage
```typescript
// React hook
const useFeature = (featureKey: string) => {
  const { tenant, user } = useContext(AppContext);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const checkFeature = async () => {
      const result = await api.checkFeature(featureKey, {
        tenantId: tenant.id,
        userId: user.id
      });
      setEnabled(result.enabled);
    };
    
    checkFeature();
  }, [featureKey, tenant.id, user.id]);

  return enabled;
};

// Component usage
const NewDashboard = () => {
  const showNewDashboard = useFeature('newDashboard');
  
  return showNewDashboard ? <NewDashboardUI /> : <LegacyDashboardUI />;
};
```

## Management Interface

### Admin API
```http
# Get all features
GET /api/features

# Update feature configuration
PUT /api/features/:key
Content-Type: application/json

{
  "enabled": true,
  "rolloutPercentage": 50,
  "allowedTenants": ["tenant-1"]
}

# Delete feature
DELETE /api/features/:key
```

### Audit Trail
```javascript
{
  event: 'FEATURE_UPDATED',
  severity: 'medium',
  details: {
    feature: 'newDashboard',
    changes: {
      enabled: { from: false, to: true },
      rolloutPercentage: { from: 0, to: 50 }
    },
    updatedBy: 'admin-uuid'
  }
}
```

## Monitoring & Analytics

### Usage Metrics
1. **Access Patterns**
   - Feature access count
   - User distribution
   - Tenant distribution
   - Time patterns

2. **Performance Impact**
   - Response times
   - Error rates
   - Resource usage
   - Cache efficiency

### Monitoring
```javascript
// Track feature access
const trackFeatureAccess = async (featureKey, context, enabled) => {
  await Promise.all([
    // Update counters
    redisClient.incr(`feature:${featureKey}:access`),
    redisClient.incr(`feature:${featureKey}:${enabled ? 'enabled' : 'disabled'}`),
    
    // Store access log
    SecurityAuditLog.create({
      event: 'FEATURE_ACCESS',
      details: {
        feature: featureKey,
        enabled,
        ...context
      },
      severity: 'low'
    })
  ]);
};
```

## Best Practices

### Feature Design
1. **Naming Conventions**
   - Use descriptive names
   - Follow consistent pattern
   - Include version/phase
   - Document purpose

2. **Configuration**
   - Default to disabled
   - Include expiry dates
   - Document dependencies
   - Plan rollback

### Implementation
1. **Code Organization**
   - Centralize logic
   - Clean interfaces
   - Easy rollback
   - Clear dependencies

2. **Testing**
   - Test both states
   - Verify permissions
   - Check performance
   - Monitor impact

### Operations
1. **Rollout Strategy**
   - Start small
   - Monitor closely
   - Gradual increase
   - Quick rollback

2. **Maintenance**
   - Regular cleanup
   - Update documentation
   - Monitor usage
   - Remove old flags

## Troubleshooting

### Common Issues
1. **Access Problems**
   - Cache inconsistency
   - Permission errors
   - Configuration issues
   - Network problems

2. **Performance Impact**
   - Cache misses
   - Database load
   - Memory usage
   - Network latency

### Debug Tools
1. **Feature Status**
   ```bash
   # Check feature status
   curl -X GET /api/features/status/newDashboard
   
   # View access logs
   curl -X GET /api/features/logs/newDashboard
   ```

2. **Monitoring**
   ```bash
   # Get usage metrics
   curl -X GET /api/features/metrics/newDashboard
   
   # Check error rates
   curl -X GET /api/features/errors/newDashboard
   ```

## Related Documentation
- Configuration Management
- Tenant Settings
- Access Control
- Monitoring Guide
