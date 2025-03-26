// src/routes/api/v1/secrets/+server.ts
import { error } from '@sveltejs/kit'
import type { RequestHandler } from '@sveltejs/kit'
import { Prisma } from '@prisma/client'

import prisma, { withRetry } from '$lib/prisma'

type SecretsRequest = {
  alias: string
  publicKey: string
  fileMeta: string
  fileReference: string
  fileSize: number
}
export type SecretsResponse = {
  message: string
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: SecretsRequest = await request.json()
    const { alias, publicKey, fileReference, fileMeta, fileSize } = body

    // Use withRetry and transaction for better reliability
    await withRetry(() => 
      prisma.$transaction(async (tx) => {
        // Create the secret
        await tx.secret.create({ 
          data: { 
            alias, 
            publicKey, 
            fileMeta, 
            fileReference 
          } 
        })

        // Update stats within the same transaction
        try {
          await tx.stats.update({
            where: { id: 1 },
            data: {
              totalFilesUploaded: { increment: 1 },
              totalBytesUploaded: { increment: fileSize }
            }
          })
        } catch (statsError) {
          // Log but don't fail the transaction for stats errors
          console.error(`Couldn't update stats.`, statsError)
        }

        return true
      }, {
        // Set a reasonable timeout for the transaction
        timeout: 15000 // 15 seconds
      })
    )
  } catch (e) {
    console.error('Error in secret creation:', e)

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // The .code property can be accessed in a type-safe manner
      if (e.code === 'P2002') {
        error(500, 'Alias need to be unique.');
      }
    }

    // Add more specific error handling for connection issues
    if (e instanceof Prisma.PrismaClientInitializationError) {
      error(500, 'Database connection failed. Please try again.');
    }

    error(500, 'Error storing secret.');
  }

  return new Response(JSON.stringify({ message: 'File encrypted and saved.' }), {
    status: 200
  })
}
