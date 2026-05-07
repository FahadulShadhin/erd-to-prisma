import { Request, Response, NextFunction } from 'express'
import * as service from '../services/{{modelLower}}Service'

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await service.list()
    res.json(items)
  } catch (err) { next(err) }
}

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await service.get(Number(req.params.id))
    res.json(item)
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await service.create(req.body)
    res.status(201).json(created)
  } catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await service.update(Number(req.params.id), req.body)
    res.json(updated)
  } catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.remove(Number(req.params.id))
    res.status(204).end()
  } catch (err) { next(err) }
}

export default { list, get, create, update, remove }
