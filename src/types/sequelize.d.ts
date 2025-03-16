// Fix Sequelize import compatibility issues
import * as SequelizeNS from 'sequelize';

// First, create a module augmentation for Sequelize
declare module 'sequelize' {
  // Re-export the Sequelize class constructor as a named export
  export const Sequelize: typeof SequelizeNS.Sequelize;
  export const Model: typeof SequelizeNS.Model;
  export const DataTypes: typeof SequelizeNS.DataTypes;
  export const Op: typeof SequelizeNS.Op;
  
  // Export common types
  export type ModelStatic<T extends SequelizeNS.Model> = SequelizeNS.ModelStatic<T>;
  export type Transaction = SequelizeNS.Transaction;
  export type WhereOptions = SequelizeNS.WhereOptions;
  export type FindOptions = SequelizeNS.FindOptions;
  export type ModelAttributes = SequelizeNS.ModelAttributes;
  export type ModelOptions = SequelizeNS.ModelOptions;
  export type CreateOptions = SequelizeNS.CreateOptions;
  export type UpdateOptions = SequelizeNS.UpdateOptions;
  
  // Helper to make our custom types work
  export import Sequelize = SequelizeNS.Sequelize;
  export import Model = SequelizeNS.Model;
}

// Also create type aliases for direct use
export type Sequelize = SequelizeNS.Sequelize;
export type Model = SequelizeNS.Model;
export type ModelStatic<T extends SequelizeNS.Model> = SequelizeNS.ModelStatic<T>;