const { PrismaClient } = require('@prisma/client');

class DatabaseManager {
  constructor() {
    this.tenantConnections = new Map();
    this.defaultClient = new PrismaClient();
  }

  async getTenantConnection(tenantId) {
    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId);
    }

    const tenant = await this.defaultClient.tenant.findUnique({
      where: { id: tenantId },
      select: { databaseUrl: true }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: tenant.databaseUrl
        }
      }
    });

    this.tenantConnections.set(tenantId, prisma);
    return prisma;
  }

  async createTenantDatabase(tenantSlug) {
    // Implementation for creating new tenant database
    // This would involve creating a new database and running migrations
  }
}

module.exports = new DatabaseManager();
