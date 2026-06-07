const { Router } = require('express')
const fs = require('fs')
const path = require('path')

const router = Router()

router.use('/', require('./research'))
router.use('/', require('./products'))
router.use('/', require('./content'))
router.use('/', require('./monetize'))
router.use('/', require('./publish'))
router.use('/deals', require('./deals'))

const KPI_FILE = path.join(__dirname, '../data/kpi.json')
const PH_CONFIG_FILE = path.join(__dirname, '../config/pricehawk.json')

router.get('/kpi', (req, res) => {
  try {
    const kpi = JSON.parse(fs.readFileSync(KPI_FILE, 'utf8'))
    const config = JSON.parse(fs.readFileSync(PH_CONFIG_FILE, 'utf8'))
    const month = new Date().getMonth() + 1
    const target = month <= 1 ? config.year_one_targets.month_1
      : month <= 3 ? config.year_one_targets.month_3
      : month <= 6 ? config.year_one_targets.month_6
      : config.year_one_targets.month_12
    res.json({ ...kpi, current_month: month, target })
  } catch {
    res.json({ articles_published: 0, articles_draft: 0, affiliate_clicks: 0, revenue_inr: 0, telegram_subscribers: 0 })
  }
})

module.exports = router
