import { S3 } from '@aws-sdk/client-s3';
import { TenantContext } from '../middleware/tenant-context';
import { AppError } from '../types/error.types';

export class TenantAwareStorageService {
  private readonly s3: S3;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION
    });
  }

  private getTenantPath(path: string): string {
    const tenantId = TenantContext.getCurrentTenant();
    return `tenants/${tenantId}/${path}`;
  }

  async uploadFile(
    file: Buffer,
    path: string,
    metadata: Record<string, string>
  ): Promise<string> {
    const tenantPath = this.getTenantPath(path);

    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: tenantPath,
      Body: file,
      Metadata: {
        ...metadata,
        tenantId: TenantContext.getCurrentTenant()!
      }
    });

    return tenantPath;
  }

  async getFile(path: string): Promise<Buffer> {
    const tenantPath = this.getTenantPath(path);

    const result = await this.s3.getObject({
      Bucket: process.env.S3_BUCKET!,
      Key: tenantPath
    });

    // Verify tenant ID in metadata
    const fileTenantId = result.Metadata?.tenantId;
    if (fileTenantId !== TenantContext.getCurrentTenant()) {
      throw new AppError('UNAUTHORIZED', 'File access denied');
    }

    return result.Body as Buffer;
  }

  async deleteFile(path: string): Promise<void> {
    const tenantPath = this.getTenantPath(path);

    await this.s3.deleteObject({
      Bucket: process.env.S3_BUCKET!,
      Key: tenantPath
    });
  }
}
