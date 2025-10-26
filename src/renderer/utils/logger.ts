interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  message: string;
  context?: string;
  error?: Error;
}

const MAX_LOGS = 100;
const logs: LogEntry[] = [];

function addLog(entry: LogEntry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift(); // Remove oldest entry
  }
}

export const logger = {
  error(message: string, error?: Error, context?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'error',
      message,
      context,
      error,
    };

    addLog(entry);
    console.error(`[${context || 'App'}]`, message, error);
  },

  warn(message: string, context?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'warn',
      message,
      context,
    };

    addLog(entry);
    console.warn(`[${context || 'App'}]`, message);
  },

  info(message: string, context?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'info',
      message,
      context,
    };

    addLog(entry);
    console.log(`[${context || 'App'}]`, message);
  },

  // Get all logs for debugging
  getLogs() {
    return [...logs];
  },

  // Get logs as formatted text
  getLogsAsText() {
    return logs
      .map(log => {
        const timestamp = log.timestamp.toISOString();
        const context = log.context ? `[${log.context}]` : '';
        const error = log.error ? `\n  ${log.error.stack}` : '';
        return `[${timestamp}] ${log.level.toUpperCase()} ${context} ${log.message}${error}`;
      })
      .join('\n');
  },

  // Clear all logs
  clear() {
    logs.length = 0;
  },

  // Export logs to clipboard
  async copyLogsToClipboard() {
    try {
      const text = this.getLogsAsText();
      await navigator.clipboard.writeText(text);
      console.log('Logs copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy logs:', error);
      return false;
    }
  },
};

// Log unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled error', event.error, 'Window');
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', event.reason, 'Promise');
});
