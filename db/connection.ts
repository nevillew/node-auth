import { Sequelize } from 'sequelize';
import { dbConfig } from './config';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private sequelize: Sequelize;
  private isConnected: boolean = false;

  private constructor() {
    this.sequelize = new Sequelize(dbConfig);
    this.setupErrorHandling();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupErrorHandling(): void {
    this.sequelize.addHook('beforeConnect', async (config: any) => {
      console.log('Attempting database connection...');
    });

    this.sequelize.addHook('afterConnect', async (connection: any) => {
      this.isConnected = true;
      console.log('Database connection established successfully');
    });

    this.sequelize.addHook('beforeDisconnect', async () => {
      this.isConnected = false;
      console.log('Closing database connection...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.sequelize.authenticate();
      this.isConnected = true;
    } catch (error) {
      console.error('Unable to connect to the database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.sequelize.close();
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  public getSequelize(): Sequelize {
    return this.sequelize;
  }

  public isConnectedToDatabase(): boolean {
    return this.isConnected;
  }
}

export const db = DatabaseConnection.getInstance();
