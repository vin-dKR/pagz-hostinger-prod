import "dotenv/config";
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client';

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    // Bumped from 5 → 20. The 30s order-persist transaction holds one
    // connection; the cart sweep + verify-files endpoint can run in
    // parallel and held all 5 slots, leaving the persist with no pool
    // slot to grab — Razorpay captured ₹X but no Order written.
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || 20),
});
const prisma: PrismaClient = new PrismaClient({ adapter });

export { prisma }