require('dotenv').config();
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const loadSeedData = async () => {
  logger.info('Payment service seed data - not implemented');
  await pool.end();
};
loadSeedData().then(() => process.exit(0)).catch(() => process.exit(1));
