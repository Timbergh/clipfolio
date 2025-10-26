type Task<T> = () => Promise<T>;

export class AsyncQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.running++;
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.next();
        }
      };

      if (this.running < this.concurrency) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }

  private next() {
    if (this.running >= this.concurrency) return;
    const job = this.queue.shift();
    if (job) job();
  }
}

export const createQueue = (concurrency: number) => new AsyncQueue(concurrency);


