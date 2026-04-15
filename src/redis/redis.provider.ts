import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

// Token used to inject the Redis client
export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    const redisUrl = process.env.REDIS_URL;
    const redisTls = process.env.REDIS_TLS === 'true';

    const baseOptions = {
      // Retry strategy: stop after 3 retries
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    };

    const client = redisUrl
      ? new Redis(redisUrl, {
          ...baseOptions,
          ...(redisUrl.startsWith('rediss://') || redisTls ? { tls: {} } : {}),
        })
      : new Redis({
          ...baseOptions,
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          username: process.env.REDIS_USERNAME,
          password: process.env.REDIS_PASSWORD,
          ...(redisTls ? { tls: {} } : {}),
        });

    client.on('connect', () => console.log('✅ Redis connected'));
    client.on('error', (err: any) => {
      const details = err?.message || err?.code || err?.name || String(err);
      console.error('❌ Redis error:', details);
    });

    return client;
  },
};
