const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => logger.info('Database connection established'));
pool.on('error', (err) => logger.error('Unexpected database error', { error: err.message }));

const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id SERIAL PRIMARY KEY,
        bill_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'COMPLETED',
        transaction_id VARCHAR(100),
        idempotency_key VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
      CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
    `);
    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Failed to initialize database schema', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDatabase };
