import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "../interfaces/index.js";

/**
 * Real implementation (not mocked) — docs/architecture.md §5.1: "S3 is cheap and gives us real
 * pre-signed upload URLs from day one, no reason to mock". Nothing calls this yet in Foundation phase
 * (image upload arrives with the Marketplace phase, docs/architecture.md §9) — it's wired into
 * ProvidersModule so the DI seam exists, but exercising it for real needs AWS_REGION/AWS_S3_BUCKET set.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>("AWS_REGION");
    this.bucket = this.config.get<string>("AWS_S3_BUCKET") ?? "";
    this.client = new S3Client(region ? { region } : {});

    if (!this.bucket) {
      this.logger.warn(
        "AWS_S3_BUCKET is not set — S3StorageProvider will throw if actually invoked. Safe for now: " +
          "nothing calls it until the Marketplace phase adds listing image upload.",
      );
    }
  }

  async getUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 900,
    });
    const region = this.config.get<string>("AWS_REGION");
    const publicUrl = `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
    return { uploadUrl, publicUrl };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
