'use strict';

async function withFreshWorldScenario(createWorld, scenario, captureFailure) {
  const world = await createWorld();
  try {
    return await scenario(world);
  } catch (error) {
    try {
      await captureFailure(error);
    } catch {
      // Failure capture is diagnostic and must never replace the scenario error.
    }
    throw error;
  } finally {
    try {
      await world.ownBrowser.close();
    } catch {
      // Match the browser suite's cleanup policy: keep the original result.
    }
  }
}

module.exports = { withFreshWorldScenario };
