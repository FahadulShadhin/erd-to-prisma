import express from 'express'
const router = express.Router()
import controller from '../controllers/{{modelLower}}Controller'

router.get('/', controller.list)
router.get('/:id', controller.get)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.delete('/:id', controller.remove)

export default router
