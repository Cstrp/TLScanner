import pino from "pino";

/**
 * Logger configuration using pino.
 * This logger will output logs in a pretty format with colors.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
  formatters: {
    level(label: string) {
      return { level: label.toUpperCase() };
    },
  },
  base: { pid: process.pid },
});
