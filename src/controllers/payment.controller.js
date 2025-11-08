const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const axios = require('axios');

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007';

class PaymentController {
  async processPayment(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { bill_id, patient_id, amount, payment_method, idempotency_key } = req.body;

      // Check idempotency
      const existing = await client.query('SELECT * FROM payments WHERE idempotency_key = $1', [idempotency_key]);
      if (existing.rows.length > 0) {
        logger.info('Duplicate payment request detected', { idempotencyKey: idempotency_key });
        return res.json({ success: true, data: existing.rows[0], duplicate: true, correlationId: req.correlationId });
      }

      // Process payment
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await client.query(
        `INSERT INTO payments (bill_id, patient_id, amount, payment_method, transaction_id, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED') RETURNING *`,
        [bill_id, patient_id, amount, payment_method, transactionId, idempotency_key]
      );

      const payment = result.rows[0];

      // Update bill status
      try {
        await axios.put(`${BILLING_SERVICE_URL}/v1/bills/${bill_id}/pay`, { payment_id: payment.payment_id });
      } catch (error) {
        logger.warn('Failed to update bill status', { error: error.message });
      }

      await client.query('COMMIT');

      // Send notification
      try {
        await axios.post(`${NOTIFICATION_SERVICE_URL}/v1/notifications`, {
          type: 'PAYMENT_RECEIVED',
          patient_id,
          message: `Payment of $${amount} received successfully`,
          metadata: { paymentId: payment.payment_id, amount, transactionId }
        });
      } catch (error) {
        logger.warn('Failed to send notification', { error: error.message });
      }

      logger.info('Payment processed', { correlationId: req.correlationId, paymentId: payment.payment_id });
      res.status(201).json({ success: true, data: payment, correlationId: req.correlationId });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async processRefund(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { payment_id, refund_amount, reason } = req.body;

      const paymentResult = await client.query('SELECT * FROM payments WHERE payment_id = $1', [payment_id]);
      if (paymentResult.rows.length === 0) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      const payment = paymentResult.rows[0];
      if (payment.status === 'REFUNDED') {
        throw new AppError('Payment already refunded', 400, 'ALREADY_REFUNDED');
      }

      const refundTxnId = `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const refundResult = await client.query(
        `INSERT INTO payments (bill_id, patient_id, amount, payment_method, transaction_id, status)
         VALUES ($1, $2, $3, $4, $5, 'REFUND') RETURNING *`,
        [payment.bill_id, payment.patient_id, -refund_amount, payment.payment_method, refundTxnId]
      );

      await client.query('UPDATE payments SET status = $1 WHERE payment_id = $2', ['REFUNDED', payment_id]);

      await client.query('COMMIT');

      logger.info('Refund processed', { correlationId: req.correlationId, paymentId: payment_id, refundAmount: refund_amount });
      res.json({ success: true, data: refundResult.rows[0], correlationId: req.correlationId });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async getPayment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM payments WHERE payment_id = $1', [id]);
      if (result.rows.length === 0) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }
      res.json({ success: true, data: result.rows[0], correlationId: req.correlationId });
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req, res, next) {
    try {
      const { patient_id, status, page = 1, limit = 10 } = req.query;
      const conditions = [];
      const values = [];
      let paramCount = 0;

      if (patient_id) {
        paramCount++;
        conditions.push(`patient_id = $${paramCount}`);
        values.push(patient_id);
      }

      if (status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      const countResult = await pool.query(`SELECT COUNT(*) FROM payments ${whereClause}`, values);
      const totalCount = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...values, limit, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        pagination: { page: parseInt(page), limit: parseInt(limit), totalCount, totalPages: Math.ceil(totalCount / limit) },
        correlationId: req.correlationId
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
