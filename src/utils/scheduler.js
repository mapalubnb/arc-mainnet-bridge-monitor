import { logger } from "../logger.js";

export function scheduleTask(name, intervalMs, task) {
  let running = false;

  const run = async () => {
    if (running) {
      logger.debug("任务仍在运行，跳过本轮", { name });
      return;
    }
    running = true;
    try {
      await task();
    } catch (error) {
      logger.warn("任务执行失败", { name, error: error.message });
    } finally {
      running = false;
    }
  };

  run();
  return setInterval(run, intervalMs);
}
