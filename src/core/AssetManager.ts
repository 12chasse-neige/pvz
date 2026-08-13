/**
 * Image asset loading seam. The MVP renders everything procedurally and
 * never loads assets; if real sprite sheets are added later they go
 * through here without touching game logic.
 */
export class AssetManager {
  private images = new Map<string, HTMLImageElement>();

  async load(manifest: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(manifest).map(async ([key, url]) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        this.images.set(key, img);
      }),
    );
  }

  get(name: string): HTMLImageElement | undefined {
    return this.images.get(name);
  }
}
