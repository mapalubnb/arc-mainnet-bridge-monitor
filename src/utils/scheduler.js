import { formatError, logger } from "../logger.js";

export function scheduleTask(name, intervalMs, task) {
  let running = false;
  let runCount = 0;

  const run = async () => {
    if (running) {
      logger.debug("任务调度跳过：上一轮仍在执行", {
        taskName: name,
        intervalMs,
        reason: "任务重入保护 Task Re-entry Guard"
      });
      return;
    }

    const startedAt = Date.now();
    runCount += 1;
    running = true;

    logger.debug("任务开始执行", {
      taskName: name,
      runCount,
      intervalMs
    });

    try {
      await task();
      logger.debug("任务执行完成", {
        taskName: name,
        runCount,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      logger.warn("任务执行失败，将等待下一轮重试", {
        taskName: name,
        runCount,
        durationMs: Date.now() - startedAt,
        error: formatError(error)
      });
    } finally {
      running = false;
    }
  };

  logger.info("注册定时任务", {
    taskName: name,
    intervalMs
  });

  run();
  return setInterval(run, intervalMs);
}
