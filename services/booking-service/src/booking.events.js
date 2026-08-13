const { createKafkaClient } = require("../../../packages/common/kafka/client.js");
const { TOPICS, EVENT_TYPES } = require("../../../packages/common/kafka/constants.js");
const { createEventEnvelope } = require("../../../packages/common/kafka/envelope.js");
const env = require("./config/env.js");

let producer;
let producerReady = false;

const kafkaEnabled = () => env.KAFKA_ENABLED !== "false";

const toBookingPayload = (booking) => ({
  bookingId: booking._id.toString(),
  listingId: booking.listing.toString(),
  ownerId: booking.owner.toString(),
  guestId: booking.guest.toString(),
  guestName: booking.guestName,
  guestEmail: booking.guestEmail,
  listingTitleSnapshot: booking.listingTitleSnapshot,
  nightlyPriceSnapshot: Number(booking.nightlyPriceSnapshot || 0),
  checkIn: booking.checkIn?.toISOString(),
  checkOut: booking.checkOut?.toISOString(),
  nights: Number(booking.nights || 0),
  subtotalPrice: Number(booking.subtotalPrice || 0),
  taxAmount: Number(booking.gstAmount || 0),
  totalPrice: Number(booking.totalPrice || 0),
  status: booking.status,
});

const connectBookingEventProducer = async () => {
  if (!kafkaEnabled() || producerReady) {
    return;
  }

  const kafka = createKafkaClient({
    clientId: env.KAFKA_CLIENT_ID || "booking-service",
    brokers: env.KAFKA_BROKERS,
  });

  producer = kafka.producer({ allowAutoTopicCreation: true });
  await producer.connect();
  producerReady = true;
  console.log("Booking Service Kafka producer connected");
};

const publishBookingEvent = async ({ eventType, booking }) => {
  if (!kafkaEnabled()) {
    return;
  }

  try {
    if (!producerReady) {
      await connectBookingEventProducer();
    }

    const event = createEventEnvelope({
      eventType,
      producer: "booking-service",
      payload: toBookingPayload(booking),
    });

    await producer.send({
      topic: TOPICS.BOOKING_EVENTS,
      messages: [
        {
          key: booking._id.toString(),
          value: JSON.stringify(event),
        },
      ],
    });
  } catch (err) {
    console.error(`Failed to publish ${eventType}:`, err.message);
  }
};

const publishBookingCreated = (booking) => {
  return publishBookingEvent({ eventType: EVENT_TYPES.BOOKING_CREATED, booking });
};

const publishBookingCancelled = (booking) => {
  return publishBookingEvent({ eventType: EVENT_TYPES.BOOKING_CANCELLED, booking });
};

const disconnectBookingEventProducer = async () => {
  if (producerReady && producer) {
    await producer.disconnect();
    producerReady = false;
  }
};

module.exports = {
  connectBookingEventProducer,
  disconnectBookingEventProducer,
  publishBookingCancelled,
  publishBookingCreated,
};
