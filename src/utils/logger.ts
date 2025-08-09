type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
  stack?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logQueue: LogEntry[] = [];
  private maxQueueSize = 100;

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
    };

    // In development, output to console
    if (this.isDevelopment) {
      const styles = {
        debug: 'color: #888',
        info: 'color: #2563eb',
        warn: 'color: #f59e0b',
        error: 'color: #ef4444',
      };

      const style = styles[level];
      const prefix = `[${level.toUpperCase()}]`;
      
      if (level === 'error' && data instanceof Error) {
        console.error(`%c${prefix}`, style, message, data);
        entry.stack = data.stack;
      } else if (data !== undefined) {
        console.log(`%c${prefix}`, style, message, data);
      } else {
        console.log(`%c${prefix}`, style, message);
      }
    }

    // Add to queue for potential remote logging
    this.addToQueue(entry);
  }

  private addToQueue(entry: LogEntry) {
    this.logQueue.push(entry);
    
    // Maintain queue size limit
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue.shift();
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | any) {
    this.log('error', message, error);
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 10): LogEntry[] {
    return this.logQueue.slice(-count);
  }

  // Clear log queue
  clearLogs() {
    this.logQueue = [];
  }

  // Future: Send logs to remote service
  async sendLogsToRemote() {
    if (this.logQueue.length === 0) return;
    
    // This would be implemented when you have a logging service
    // For now, it's a placeholder
    try {
      // const response = await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(this.logQueue),
      // });
      // if (response.ok) {
      //   this.clearLogs();
      // }
    } catch (error) {
      // Silently fail to avoid infinite loop
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export for use throughout the application
export default logger;