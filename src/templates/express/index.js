const express = require('express')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const app = express()
app.use(express.json())

const routes = require('./routes')
app.use('/api', routes)

app.get('/', (req, res) => res.send('Welcome to {{appName}}'))

const port = process.env.PORT || 3000
app.listen(port, () => console.log('Server listening on', port))

module.exports = app
