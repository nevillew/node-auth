type ScopeHierarchy = {
  [scope: string]: string[];
};

const SCOPE_HIERARCHY: ScopeHierarchy = {
  // Admin scope includes all other scopes
  'admin': ['*'],

  // Resource management scopes
  'users:manage': ['users:read', 'users:write', 'users:delete'],
  'tenants:manage': ['tenants:read', 'tenants:write', 'tenants:delete'],
  'roles:manage': ['roles:read', 'roles:write', 'roles:delete'],

  // Read scopes
  'users:read': ['users:profile:read', 'users:activity:read'],
  'tenants:read': ['tenants:settings:read', 'tenants:audit:read'],
  'roles:read': ['roles:permissions:read'],

  // Write scopes
  'users:write': ['users:profile:write', 'users:settings:write'],
  'tenants:write': ['tenants:settings:write', 'tenants:config:write'],
  'roles:write': ['roles:permissions:write'],

  // Security scopes
  'security:manage': [
    'security:audit:read',
    'security:settings:write',
    'security:auth:manage'
  ],

  // Feature-specific scopes
  'notifications:manage': ['notifications:read', 'notifications:write'],
  'files:manage': ['files:read', 'files:write', 'files:delete'],
  'billing:manage': ['billing:read', 'billing:write']
};

// Flatten scope hierarchy for validation
const FLAT_SCOPES = new Set<string>();
Object.entries(SCOPE_HIERARCHY).forEach(([parent, children]) => {
  FLAT_SCOPES.add(parent);
  children.forEach(child => {
    if (child !== '*') FLAT_SCOPES.add(child);
  });
});

function expandScope(scope: string): string[] {
  if (scope === '*') return Array.from(FLAT_SCOPES);
  
  const expanded = new Set<string>([scope]);
  const children = SCOPE_HIERARCHY[scope] || [];
  
  children.forEach(child => {
    if (child === '*') {
      Array.from(FLAT_SCOPES).forEach(s => expanded.add(s));
    } else {
      expanded.add(child);
      const grandChildren = expandScope(child);
      grandChildren.forEach(s => expanded.add(s));
    }
  });
  
  return Array.from(expanded);
}

function validateScopes(scopes: string[]): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.every(scope => FLAT_SCOPES.has(scope));
}

function hasRequiredScopes(userScopes: string[], requiredScopes: string[]): boolean {
  const expandedUserScopes = new Set(
    userScopes.flatMap(scope => expandScope(scope))
  );
  
  return requiredScopes.every(scope => 
    expandedUserScopes.has(scope) || expandedUserScopes.has('*')
  );
}

export {
  SCOPE_HIERARCHY,
  FLAT_SCOPES,
  expandScope,
  validateScopes,
  hasRequiredScopes
};