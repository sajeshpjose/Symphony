import { logger, task } from "@trigger.dev/sdk";

// First task, used to check the Trigger.dev connection.
// Run it from the dashboard's Test page with: { "name": "Symph" }
export const helloWorld = task({
  id: "hello-world",
  maxDuration: 60,
  run: async (payload: { name?: string }) => {
    const name = payload.name?.trim() || "Symph";
    logger.info("Hello from Trigger.dev", { name });
    return {
      message: `Hello ${name}!`,
      timestamp: new Date().toISOString(),
    };
  },
});
