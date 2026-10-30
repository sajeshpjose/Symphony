import { defineConfig } from "@trigger.dev/sdk";

// Long-running jobs for Symph: research runs and post batches (decision D31).
// Short calls stay in netlify/functions (30 s limit).
export default defineConfig({
  project: "proj_upzozzqxpiovdxrciytc",
  dirs: ["./src/trigger"],
  // A research run takes about 40 minutes; allow an hour.
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [],
  },
});
