import { config } from "../config.js";
import { formatError, logger } from "../logger.js";

export function scheduleTask(name, intervalMs, task) {
  let running = false;
  let runCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let skipCount = 0;
  let lastDurationMs = null;
  let lastSuccessAt = null;
  let lastFailureAt = null;
  let lastHeartbeatAt = 0;

  const run = async () => {
    if (running) {
      skipCount += 1;
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
      successCount += 1;
      lastDurationMs = Date.now() - startedAt;
      lastSuccessAt = new Date().toISOString();
      logger.debug("任务执行完成", {
        taskName: name,
        runCount,
        durationMs: lastDurationMs
      });
    } catch (error) {
      failureCount += 1;
      lastDurationMs = Date.now() - startedAt;
      lastFailureAt = new Date().toISOString();
      logger.warn("任务执行失败，将等待下一轮重试", {
        taskName: name,
        runCount,
        durationMs: lastDurationMs,
        error: formatError(error)
      });
    } finally {
      running = false;
      const now = Date.now();
      if (now - lastHeartbeatAt >= config.logHeartbeatMs) {
        lastHeartbeatAt = now;
        logger.info("任务健康心跳", {
          taskName: name,
          intervalMs,
          runCount,
          successCount,
          failureCount,
          skipCount,
          lastDurationMs,
          lastSuccessAt,
          lastFailureAt
        });
      }
    }
  };

  logger.info("注册定时任务", {
    taskName: name,
    intervalMs,
    heartbeatMs: config.logHeartbeatMs
  });

  run();
  return setInterval(run, intervalMs);
}
