/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly REPLICATE_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        REPLICATE_API_TOKEN: string
      }
    }
  }
}
