const { createKafkaClient } = require("../../../packages/common/kafka/client.js");
const { EVENT_TYPES, TOPICS } = require("../../../packages/common/kafka/constants.js");
const env = require("./config/env.js");
const notificationService = require("./notification.service.js");

let consumer;
let consumerRunning = false;

const kafkaEnabled = () => env.KAFKA_ENABLED !== "false";

const handleBookingEvent = async (event) => {
  if (event.eventType === EVENT_TYPES.BOOKING_CREATED) {
    await notificationService.createBookingCreatedNotification(event);
  }

  if (event.eventType === EVENT_TYPES.BOOKING_CANCELLED) {
    await notificationService.createBookingCancelledNotification(event);
  }
};

const startNotificationConsumer = async () => {
  if (!kafkaEnabled() || consumerRunning) {
    return;
  }

  const kafka = createKafkaClient({
    clientId: env.NOTIFICATION_KAFKA_CLIENT_ID || "notification-service",
    brokers: env.KAFKA_BROKERS,
  });

  consumer = kafka.consumer({
    groupId: env.NOTIFICATION_KAFKA_GROUP_ID || "notification-service",
    allowAutoTopicCreation: true,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.BOOKING_EVENTS, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        await handleBookingEvent(event);
      } catch (err) {
        console.error("Failed to process booking event:", err.message);
        throw err;
      }
    },
  });

  consumerRunning = true;
  console.log("Notification Service Kafka consumer connected");
};

const stopNotificationConsumer = async () => {
  if (consumerRunning && consumer) {
    await consumer.disconnect();
    consumerRunning = false;
  }
};

module.exports = {
  startNotificationConsumer,
  stopNotificationConsumer,
};
