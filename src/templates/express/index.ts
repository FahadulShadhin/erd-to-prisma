import express from 'express'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const app = express()
app.use(express.json())

import routes from './routes'
app.use('/api', routes)

app.get('/', (req, res) => res.send(`Welcome to {{appName}}`))

const port = process.env.PORT || 3000
app.listen(port, () => console.log('Server listening on', port))

export default app
