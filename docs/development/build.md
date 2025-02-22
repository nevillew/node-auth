# Build & Development Setup

## Project Structure
```
.
├── src/             # Application source code
├── sdk/             # TypeScript SDK
├── docs/            # Documentation
├── migrations/      # Database migrations
└── tests/          # Test files
```

## Dependencies
Key dependencies from package.json:
- Express.js 4.x - Web framework
- Sequelize 6.x - ORM
- Bull 4.x - Job queue
- Winston 3.x - Logging
- Jest 29.x - Testing

## Development Scripts
```bash
# Start development server
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Database operations
npm run migrate
npm run seed

# SDK development
npm run build:sdk
npm run test:sdk
```

## Environment Configuration
Required variables in .env:
```
# Application
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_NAME=multitenant

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret
```

## TypeScript Configuration
SDK configuration from tsconfig.json:
- Target: ES2018
- Module: ESNext
- Strict type checking
- Source maps enabled
- Declaration files generated

## Development Workflow
1. Create feature branch
2. Install dependencies
3. Set up environment
4. Run development server
5. Implement changes
6. Run tests
7. Submit PR

## Building for Production
1. Verify environment variables
2. Run full test suite
3. Build SDK
4. Generate documentation
5. Create production build
