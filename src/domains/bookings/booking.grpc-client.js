const grpc = require("@grpc/grpc-js");
const env = require("../../config/env.js");
const loadProto = require("../../shared/grpc/loadProto.js");

const bookingProto = loadProto("booking.proto").wanderlust.booking.v1;
const target = env.BOOKING_SERVICE_URL || "localhost:50053";
const client = new bookingProto.BookingService(target, grpc.credentials.createInsecure());

const unary = (methodName, request) => {
  return new Promise((resolve, reject) => {
    client[methodName](request, (err, response) => {
      if (err) {
        return reject(err);
      }

      resolve(response);
    });
  });
};

module.exports = {
  cancelBooking: (request) => unary("CancelBooking", request),
  checkAvailability: (request) => unary("CheckAvailability", request),
  createBooking: (request) => unary("CreateBooking", request),
  getBookedDates: (request) => unary("GetBookedDates", request),
  getBooking: (request) => unary("GetBooking", request),
  getGuestBookings: (request) => unary("GetGuestBookings", request),
  getOwnerBookings: (request) => unary("GetOwnerBookings", request),
  markOwnerSeen: (request) => unary("MarkOwnerSeen", request),
};
