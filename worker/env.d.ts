declare namespace Cloudflare {
  interface Env {
    BUCKET: R2Bucket;
    MANAGE_PASSWORD: string;
  }
  interface GlobalProps {
    mainModule: typeof import('./index');
  }
}
