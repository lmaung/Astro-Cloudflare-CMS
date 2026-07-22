/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CONTENT_REPO_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
