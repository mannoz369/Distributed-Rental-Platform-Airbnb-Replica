const { Kafka, logLevel } = require("kafkajs");

const parseBrokers = (value) => {
  return (value || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
};

const createKafkaClient = ({ clientId, brokers }) => {
  return new Kafka({
    clientId,
    brokers: parseBrokers(brokers),
    connectionTimeout: 3000,
    requestTimeout: 5000,
    logLevel: logLevel.ERROR,
    retry: {
      retries: 3,
      initialRetryTime: 300,
    },
  });
};

module.exports = {
  createKafkaClient,
  parseBrokers,
};
