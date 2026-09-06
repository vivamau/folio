function startSnapshotScheduler(
  service,
  {
    intervalMs = 60000,
    onError = (error) =>
      console.error("Monthly snapshot job failed:", error.message),
  } = {},
) {
  let running = null,
    stopped = false;
  const tick = () => {
    if (stopped || running) return;
    running = service
      .run()
      .catch(onError)
      .finally(() => {
        running = null;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
module.exports = { startSnapshotScheduler };
