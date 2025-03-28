import { logger } from '@elizaos/core';

// Custom levels from @elizaos/core logger
export const LOG_LEVELS = {
  ...logger.levels.values,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

export interface LogEntry {
  level: number;
  time: number;
  msg: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogFilter {
  since?: number;
  level?: LogLevel;
  agentName?: string;
  agentId?: string;
  limit?: number;
}

export interface LogResponse {
  logs: LogEntry[];
  count: number;
  total: number;
  level: string;
  levels: string[];
}

export class LogService {
  private static instance: LogService;

  private constructor() {}

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  private getLogDestination() {
    const destination = (logger as unknown)[Symbol.for('pino-destination')];
    if (!destination?.recentLogs) {
      throw new Error('Logger destination not available');
    }
    return destination;
  }

  public getLogs(filter: LogFilter): LogResponse {
    const {
      since = Date.now() - 3600000,
      level = 'all',
      agentName = 'all',
      agentId = 'all',
      limit = 100,
    } = filter;

    const destination = this.getLogDestination();
    const recentLogs: LogEntry[] = destination.recentLogs();
    const requestedLevelValue = LOG_LEVELS[level] || LOG_LEVELS.info;
    const finalLimit = Math.min(limit, 1000);

    const filtered = recentLogs
      .filter((log) => {
        const timeMatch = log.time >= since;
        let levelMatch = true;
        if (level && level !== 'all') {
          levelMatch = log.level === requestedLevelValue;
        }
        const agentNameMatch = !agentName || agentName === 'all' || log.agentName === agentName;
        const agentIdMatch = !agentId || agentId === 'all' || log.agentId === agentId;
        return timeMatch && levelMatch && agentNameMatch && agentIdMatch;
      })
      .slice(-finalLimit);

    return {
      logs: filtered,
      count: filtered.length,
      total: recentLogs.length,
      level: level,
      levels: Object.keys(LOG_LEVELS),
    };
  }

  public clearLogs(): void {
    const destination = this.getLogDestination();
    if (!destination?.clear) {
      throw new Error('Logger clear method not available');
    }
    destination.clear();
    logger.debug('Logs cleared');
  }
}
