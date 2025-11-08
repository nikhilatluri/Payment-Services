const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { validate } = require('../middleware/validator');

router.post('/', validate('processPayment'), paymentController.processPayment);
router.post('/refund', validate('processRefund'), paymentController.processRefund);
router.get('/', validate('searchQuery'), paymentController.getPayments);
router.get('/:id', paymentController.getPayment);

module.exports = router;
