const swaggerJsdoc = require('swagger-jsdoc');
module.exports = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Payment Service API', version: '1.0.0', description: 'HMS - Payment Service' },
    servers: [{ url: 'http://localhost:3006', description: 'Development server' }]
  },
  apis: ['./src/routes/*.js']
});
