# Payment Service

Handles payment processing and refunds for the Hospital Management System.

## Features
- **Idempotent Payments**: Uses Idempotency-Key header
- **Payment Methods**: CARD, CASH, UPI
- **Refund Processing**: Partial/full refunds
- **Transaction Tracking**: Unique transaction IDs

## Tech Stack
Node.js 18, Express, PostgreSQL, Axios, Swagger

## Quick Start
```bash
npm install
cp .env.example .env
npm start
```

## API Endpoints
- `POST /v1/payments` - Process payment (requires Idempotency-Key)
- `POST /v1/payments/refund` - Process refund
- `GET /v1/payments` - Get payments
- `GET /v1/payments/:id` - Get payment by ID

## Database Schema
```sql
CREATE TABLE payments (
  payment_id SERIAL PRIMARY KEY,
  bill_id INTEGER,
  patient_id INTEGER,
  amount DECIMAL(10,2),
  payment_method VARCHAR(20),
  status VARCHAR(20),
  transaction_id VARCHAR(100),
  idempotency_key VARCHAR(100) UNIQUE,
  created_at TIMESTAMP
);
```

## Idempotency
Use `idempotency_key` in request body to prevent duplicate charges.

## License
MIT
