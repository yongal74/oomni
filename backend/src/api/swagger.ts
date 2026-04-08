/**
 * swagger.ts — OpenAPI 3.0 스펙 생성
 * GET /api/docs — Swagger UI (개발 환경 전용)
 */
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OOMNI API',
      version: '2.1.0',
      description: 'OOMNI 봇 오케스트레이터 API',
    },
    components: {
      securitySchemes: {
        sessionToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-session-token',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/api/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
