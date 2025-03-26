// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const prismaOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
}

const prisma = globalForPrisma.prisma || new PrismaClient(prismaOptions)

if (process.env.NODE_ENV === 'development') globalForPrisma.prisma = prisma

// Add a helper function for retrying operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let retries = 0

  while (true) {
    try {
      return await operation()
    } catch (error: any) {
      retries++

      // Only retry on connection errors
      const isConnectionError = 
        error.code === 'P1001' || // Connection error
        error.code === 'P1002' || // Connection timed out
        error.code === 'P1008' || // Operations timed out
        error.code === 'P1017' || // Server closed the connection
        error instanceof Error && error.message.includes('ECONNRESET')

      if (!isConnectionError || retries >= maxRetries) {
        throw error
      }

      console.warn(`Database operation failed, retry ${retries}/${maxRetries}`, error)

      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export default prisma
