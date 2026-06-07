require('dotenv').config()
const express = require('express')
const path = require('path')
const routes = require('./routes')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use('/api', routes)

const PORT = process.env.PORT || 3050
app.listen(PORT, () => console.log(`PriceHawk running on http://localhost:${PORT}`))
