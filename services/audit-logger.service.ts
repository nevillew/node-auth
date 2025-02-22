import { TenantContext } from '../middleware/tenant-context';

export class TenantAwareAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const tenantId = TenantContext.getCurrentTenant();
    
    const enrichedEvent = {
      ...event,
      tenantId,
      timestamp: new Date(),
      actor: {
        userId: event.userId,
        tenantId: tenantId
      },
      metadata: {
        ...event.metadata,
        sourceIp: event.metadata.ip,
        userAgent: event.metadata.userAgent
      }
    };

    // Store in tenant-specific audit log
    await AuditLog.create(enrichedEvent);

    // If cross-tenant operation, log in both tenants
    if (event.targetTenantId && event.targetTenantId !== tenantId) {
      await this.logCrossTenantEvent(enrichedEvent);
    }
  }

  private async logCrossTenantEvent(
    event: EnrichedAuditEvent
  ): Promise<void> {
    // Switch tenant context
    TenantContext.setCurrentTenant(event.targetTenantId);

    // Log in target tenant
    await AuditLog.create({
      ...event,
      tenantId: event.targetTenantId,
      metadata: {
        ...event.metadata,
        sourceTenantId: event.tenantId
      }
    });

    // Restore original tenant context
    TenantContext.setCurrentTenant(event.tenantId);
  }
}
