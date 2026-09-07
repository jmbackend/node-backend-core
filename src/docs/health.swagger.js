/**
 * @openapi
 * /health:
 *   get:
 *     operationId: getHealth
 *     summary: Check API and MySQL health
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: API and MySQL are available.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       '503':
 *         description: MySQL is unavailable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
