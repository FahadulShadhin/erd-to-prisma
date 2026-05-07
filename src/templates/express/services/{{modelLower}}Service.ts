import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export const list = async () => {
  return prisma.{{modelNameLower}}.findMany()
}

export const get = async (id: number) => {
  return prisma.{{modelNameLower}}.findUnique({ where: { id } })
}

export const create = async (data: any) => {
  return prisma.{{modelNameLower}}.create({ data })
}

export const update = async (id: number, data: any) => {
  return prisma.{{modelNameLower}}.update({ where: { id }, data })
}

export const remove = async (id: number) => {
  return prisma.{{modelNameLower}}.delete({ where: { id } })
}

export default { list, get, create, update, remove }
