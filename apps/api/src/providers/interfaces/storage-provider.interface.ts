export interface StorageProvider {
  getUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }>;
  delete(key: string): Promise<void>;
}
