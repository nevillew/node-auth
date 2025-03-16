# Model Upgrade Template for AssociableModel Interface

This document provides a template for converting model files to use the new `AssociableModel` interface. Apply these changes to all model files in the project to eliminate `as any` casts and improve type safety.

## Step 1: Import the AssociableModel interface

```typescript
// Add AssociableModel to imports
import { 
  ModelAttributes,
  ModelRegistry, 
  AssociableModel 
} from '../types';
```

## Step 2: Update the model definition return type

```typescript
/**
 * Model definition using functional pattern
 * 
 * @param {Sequelize} sequelize - The Sequelize instance
 * @returns {AssociableModel<ModelAttributes, ModelCreationAttributes>} - The model with associations
 */
export const defineModel = (
  sequelize: Sequelize
): AssociableModel<ModelAttributes, ModelCreationAttributes> => {
  // Model definition code...
```

## Step 3: Replace the associate method assignment

Replace this:

```typescript
// Add association method to model
(ModelName as any).associate = associateFunction;

return ModelName;
```

With this:

```typescript
// Convert to AssociableModel to enable strongly-typed methods and properties
const associableModel = ModelName as AssociableModel<ModelAttributes, ModelCreationAttributes>;
  
// Add association method
associableModel.associate = associateFunction;

return associableModel;
```

## Step 4: Update static and instance methods

Replace this:

```typescript
// Static methods
(ModelName as any).staticMethod = async (): Promise<Result> => {
  // Method implementation
};

// Instance methods
(ModelName as any).prototype.instanceMethod = function(): Result {
  // Method implementation
};
```

With this:

```typescript
// Static methods - now properly typed with the AssociableModel
associableModel.staticMethod = async (): Promise<Result> => {
  // Method implementation
};

// Instance methods - properly typed
associableModel.prototype.instanceMethod = function(): Result {
  // Method implementation
};
```

## Example: Complete Model with AssociableModel

```typescript
import { DataTypes, Model, Sequelize, Optional } from 'sequelize';
import { ModelAttributes, ModelRegistry, AssociableModel } from '../types';

/**
 * Interface for creation attributes (with optional fields for creation)
 */
type ModelCreationAttributes = Optional<
  ModelAttributes,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Model definition using functional pattern
 * 
 * @param {Sequelize} sequelize - The Sequelize instance
 * @returns {AssociableModel<ModelAttributes, ModelCreationAttributes>} - The model with associations
 */
export const defineModel = (
  sequelize: Sequelize
): AssociableModel<ModelAttributes, ModelCreationAttributes> => {
  const TheModel = sequelize.define<Model<ModelAttributes, ModelCreationAttributes>>(
    'ModelName',
    {
      // Model field definitions
    },
    {
      // Model options
    }
  );

  // Define model associations
  const associateModel = (models: ModelRegistry): void => {
    TheModel.belongsTo(models.OtherModel);
    // Other associations
  };

  // Convert to AssociableModel
  const associableModel = TheModel as AssociableModel<ModelAttributes, ModelCreationAttributes>;
  
  // Add association method
  associableModel.associate = associateModel;

  // Add static methods
  associableModel.staticMethod = async (): Promise<Result> => {
    // Implementation
  };

  // Add instance methods
  associableModel.prototype.instanceMethod = function(): Result {
    // Implementation
  };

  return associableModel;
};

export default defineModel;
```

## Benefits of Using AssociableModel

1. Eliminates unsafe `as any` type casts
2. Provides proper type checking for model methods and properties
3. Makes model associations type-safe
4. Creates a consistent pattern across all models
5. Enables better IDE autocomplete and error detection
6. Follows functional programming principles with explicit typing