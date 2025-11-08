const Joi = require('joi');
const { AppError } = require('./errorHandler');

const schemas = {
  processPayment: Joi.object({
    bill_id: Joi.number().integer().positive().required(),
    patient_id: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().precision(2).required(),
    payment_method: Joi.string().valid('CARD', 'CASH', 'UPI').required(),
    idempotency_key: Joi.string().required()
  }),
  processRefund: Joi.object({
    payment_id: Joi.number().integer().positive().required(),
    refund_amount: Joi.number().positive().precision(2).required(),
    reason: Joi.string().max(500).optional()
  }),
  searchQuery: Joi.object({
    patient_id: Joi.number().integer().positive(),
    status: Joi.string().valid('COMPLETED', 'REFUNDED', 'REFUND', 'PENDING'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next(new AppError('Validation schema not found', 500));
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(dataToValidate, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
    if (req.method === 'GET') req.query = value;
    else req.body = value;
    next();
  };
};

module.exports = { validate };
