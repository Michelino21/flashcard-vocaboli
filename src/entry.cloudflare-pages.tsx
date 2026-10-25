/*
 * WHAT IS THIS FILE?
 *
 * Entry point del Worker su Cloudflare in produzione.
 * Il nome "cloudflare-pages" è imposto dall'adapter di Qwik, che è lo stesso
 * per Pages e per Workers: non rinominare il file.
 *
 * Learn more about the Cloudflare Workers integration here:
 * - https://qwik.dev/docs/deployments/cloudflare-workers/
 *
 */
import {
  createQwikCity,
  type PlatformCloudflarePages as PlatformCloudflareWorkers,
} from "@builder.io/qwik-city/middleware/cloudflare-pages";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

declare global {
  type QwikCityPlatform = PlatformCloudflareWorkers;
}

const fetch = createQwikCity({ render, qwikCityPlan });

export { fetch };
