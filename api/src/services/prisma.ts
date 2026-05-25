import "dotenv/config";
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client';

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    // Hostinger shared MariaDB caps `max_user_connections` (typically 10–25
    // per user). 20 was over the limit on bumpy days and the adapter
    // showed `active=0 idle=0 limit=20` because every handshake was
    // rejected. 10 stays under the cap with breathing room for admin
    // tasks. Override via env if your plan allows more.
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || 10),
    // Recycle idle connections eagerly so a flaky server doesn't keep
    // dead sockets in the pool. 30s matches MySQL wait_timeout
    // defaults on most managed plans.
    idleTimeout: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30_000),
});
const prisma: PrismaClient = new PrismaClient({ adapter });

export { prisma }