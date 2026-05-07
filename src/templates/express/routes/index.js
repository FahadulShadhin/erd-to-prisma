const express = require('express')
const router = express.Router()

// Register resource routes here
router.use('/{{modelPlural}}', require('./{{modelPlural}}'))

module.exports = router
