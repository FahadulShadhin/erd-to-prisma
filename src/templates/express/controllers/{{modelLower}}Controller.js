const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const service = require('../services/{{modelLower}}Service')

exports.list = async (req, res, next) => {
  try {
    const items = await service.list()
    res.json(items)
  } catch (err) { next(err) }
}

exports.get = async (req, res, next) => {
  try {
    const item = await service.get(Number(req.params.id))
    res.json(item)
  } catch (err) { next(err) }
}

exports.create = async (req, res, next) => {
  try {
    const created = await service.create(req.body)
    res.status(201).json(created)
  } catch (err) { next(err) }
}

exports.update = async (req, res, next) => {
  try {
    const updated = await service.update(Number(req.params.id), req.body)
    res.json(updated)
  } catch (err) { next(err) }
}

exports.remove = async (req, res, next) => {
  try {
    await service.remove(Number(req.params.id))
    res.status(204).end()
  } catch (err) { next(err) }
}
