# Testing Guide

## Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

## Running Tests
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Types

### Unit Tests
Test individual components in isolation:
```javascript
// Example user controller test
describe('UserController', () => {
  it('should create user successfully', async () => {
    const req = {
      body: {
        email: 'test@example.com',
        password: 'Password123!'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    await userController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```

### Integration Tests
Test component interactions:
```javascript
// Example API test
describe('Auth API', () => {
  it('should authenticate user', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password123'
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### E2E Tests
Test complete user flows:
```javascript
describe('User Registration Flow', () => {
  it('should register and verify email', async () => {
    // Register user
    // Verify email
    // Login
    // Check profile
  });
});
```

## Test Data

### Factories
Create test data consistently:
```javascript
// User factory
const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test User'
  };
  return User.create({ ...defaultUser, ...overrides });
};
```

### Fixtures
Store static test data:
```javascript
// User fixtures
const userFixtures = {
  validUser: {
    email: 'valid@example.com',
    password: 'ValidPass123!'
  },
  invalidUser: {
    email: 'invalid@example',
    password: 'short'
  }
};
```

## Mocking

### Service Mocks
```javascript
jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));
```

### Database Mocks
```javascript
jest.mock('../models', () => ({
  User: {
    create: jest.fn(),
    findOne: jest.fn()
  }
}));
```

## Coverage Requirements
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Best Practices
1. One assertion per test
2. Clear test descriptions
3. Setup and teardown
4. Isolated tests
5. Meaningful assertions
6. Error case testing
7. Async/await usage
8. Clean test data

## Continuous Integration
Tests run on:
- Pull requests
- Main branch commits
- Release tags
