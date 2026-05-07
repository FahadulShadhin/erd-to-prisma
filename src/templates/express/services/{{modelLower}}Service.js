const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

exports.list = async () => {
  return prisma.{{modelNameLower}}.findMany()
}

exports.get = async (id) => {
  return prisma.{{modelNameLower}}.findUnique({ where: { id } })
}

exports.create = async (data) => {
  return prisma.{{modelNameLower}}.create({ data })
}

exports.update = async (id, data) => {
  return prisma.{{modelNameLower}}.update({ where: { id }, data })
}

exports.remove = async (id) => {
  return prisma.{{modelNameLower}}.delete({ where: { id } })
}
