import { PrismaClient, Prisma } from '../../prisma/generated/client/index.js'

const prisma = new PrismaClient()

export { prisma, Prisma }
