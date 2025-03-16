# CLAUDE.md - Development Guidelines

## Commands
- Build: `npm run build:sdk` (builds SDK with TypeScript)
- Test: `npm test` (all tests with Jest)
- Single test: `npm test -- -t "test name pattern"` 
- Test watch: `npm run test:watch`
- SDK tests: `npm run test:sdk`
- Lint SDK: `cd sdk && npm run lint`
- Migrations: `npm run migrate`
- Seed data: `npm run seed`
- Development mode: `npm run dev`

## Functional Programming Principles

- **Pure Functions**: Functions with no side effects, same output for same input, no external state
- **Immutability**: Use `const` by default, spread operators, never mutate objects/arrays
- **Function Composition**: Use map/filter/reduce, compose small single-purpose functions
- **Side Effects**: Isolate to edges of application, use Either/Task patterns for operations with side effects
- **First-Class Functions**: Pass functions as arguments, return functions from functions

## Node.js Best Practices

- **Async Patterns**: Use async/await, handle rejections with try/catch, Promise.all for parallel operations
- **Error Handling**: Use custom error classes, proper propagation in async functions, meaningful logs
- **Module System**: ES modules over CommonJS, clear module responsibilities, minimal exports
- **Performance**: Avoid blocking event loop, use streams for large data, worker threads for CPU tasks
- **Security**: Validate all inputs, parameterized queries, keep dependencies updated, proper auth

## Testing Approach

- **Unit Testing**: Focus on pure function testing, input/output relationships, high coverage
- **Mocking**: Minimize mocks by designing for testability, mock external services only
- **Organization**: Group by functionality, descriptive names, Arrange-Act-Assert pattern

## Code Style and Organization

- **Naming**: camelCase for variables/functions, PascalCase for classes, prefix booleans with is/has/should
- **Structure**: Controllers → Services → Models, organize by feature when possible
- **Documentation**: JSDoc for public APIs, document complex logic, maintain README

## Library Guidance

- **Express**: Use middleware for cross-cutting concerns, logical route structure, RESTful principles
- **Database**: Use Sequelize ORM, repository pattern, proper transaction handling
- **Functional**: Consider lodash/fp or ramda, use Maybe/Either types from fp-ts when appropriate
- **Testing**: Jest for framework, Supertest for API testing, Sinon for necessary mocks

## Implementation

- **Refactoring**: Extract pure functions, replace loops with map/filter/reduce, move side effects to boundaries
- **Error Handling**: Maybe/Option for nullable values, Either/Result for operations that might fail
- **Performance**: Be aware of object creation costs, memoize expensive pure functions

## Recent Functional Programming Enhancements

The following functional programming patterns and utilities were recently added to the codebase:

1. **Enhanced AssociableModel Interface**: Improved type consistency for model associations with proper generic typing.

2. **Model Factory Pattern**: Added `createModelDefiner` higher-order function for consistent model definition.

3. **Transaction Utilities**:
   - `withTransaction`: Enhanced with retry logic and improved error handling
   - `withTransactionChain`: New utility for composing transaction operations in sequence

4. **Validation Enhancements**:
   - Added Zod integration for schema validation
   - Implemented `validateWithSchema` for type-safe data validation
   - Created `validateAndTransform` to combine validation and transformation

5. **Function Composition Utilities**:
   - `compose`: For composing pure synchronous functions
   - `composeAsync`: For composing async functions that return Result
   - `combineResults`: For combining multiple Results into one
   - `sequenceResults`: For transforming array of Results to Result of array
   - `validateAll`: For running multiple validations in parallel

6. **Error Handling Improvements**:
   - Expanded `ErrorCode` enum with more granular error types
   - Improved database error mapping with pattern matching
   - Enhanced documentation of error handling patterns