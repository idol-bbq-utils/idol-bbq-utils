import { PrismaClient, Prisma } from '../../prisma/client/index.js'

const prisma = new PrismaClient()

export { prisma, Prisma }
