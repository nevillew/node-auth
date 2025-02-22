import { Sequelize } from 'sequelize';
import { readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../connection';

export class MigrationRunner {
  private sequelize: Sequelize;
  private readonly migrationsTable = 'sequelize_migrations';

  constructor() {
    this.sequelize = db.getSequelize();
  }

  async migrate(): Promise<void> {
    await this.createMigrationsTable();
    const pendingMigrations = await this.getPendingMigrations();
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
  }

  async rollback(steps: number = 1): Promise<void> {
    const completedMigrations = await this.getCompletedMigrations();
    const migrationsToRollback = completedMigrations.slice(-steps);

    for (const migration of migrationsToRollback.reverse()) {
      await this.rollbackMigration(migration);
    }
  }

  private async createMigrationsTable(): Promise<void> {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private async getPendingMigrations(): Promise<string[]> {
    const completedMigrations = await this.getCompletedMigrations();
    const migrationFiles = this.getMigrationFiles();
    
    return migrationFiles.filter(file => 
      !completedMigrations.includes(file)
    );
  }

  private async getCompletedMigrations(): Promise<string[]> {
    const [results] = await this.sequelize.query(
      `SELECT name FROM ${this.migrationsTable} ORDER BY executed_at ASC`
    );
    return results.map((r: any) => r.name);
  }

  private getMigrationFiles(): string[] {
    const migrationPath = join(__dirname, 'scripts');
    return readdirSync(migrationPath)
      .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
      .sort();
  }

  private async runMigration(migrationName: string): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      const migration = require(`./scripts/${migrationName}`).default;
      await migration.up(this.sequelize.queryInterface, transaction);
      
      await this.sequelize.query(
        `INSERT INTO ${this.migrationsTable} (name) VALUES (:name)`,
        {
          replacements: { name: migrationName },
          transaction
        }
      );

      await transaction.commit();
      console.log(`Migrated: ${migrationName}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async rollbackMigration(migrationName: string): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      const migration = require(`./scripts/${migrationName}`).default;
      await migration.down(this.sequelize.queryInterface, transaction);
      
      await this.sequelize.query(
        `DELETE FROM ${this.migrationsTable} WHERE name = :name`,
        {
          replacements: { name: migrationName },
          transaction
        }
      );

      await transaction.commit();
      console.log(`Rolled back: ${migrationName}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
