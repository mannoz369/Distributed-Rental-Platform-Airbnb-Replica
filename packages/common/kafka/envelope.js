const { randomUUID } = require("crypto");

const createEventEnvelope = ({ eventType, producer, correlationId = "", payload }) => ({
  eventId: randomUUID(),
  eventType,
  eventVersion: 1,
  occurredAt: new Date().toISOString(),
  producer,
  correlationId,
  payload,
});

module.exports = {
  createEventEnvelope,
};
