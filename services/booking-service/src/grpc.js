const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const bookingService = require("./booking.service.js");

const protoPath = path.join(__dirname, "../../../packages/proto/booking.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const bookingProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.booking.v1;

const toIsoDate = (date) => (date ? new Date(date).toISOString() : "");

const toGrpcBooking = (booking) => {
  if (!booking) {
    return null;
  }

  return {
    id: booking._id.toString(),
    listing_id: booking.listing?.toString() || "",
    guest_id: booking.guest?.toString() || "",
    owner_id: booking.owner?.toString() || "",
    guest_name_snapshot: booking.guestName || "",
    guest_email_snapshot: booking.guestEmail || "",
    listing_title_snapshot: booking.listingTitleSnapshot || "",
    nightly_price_snapshot: Number(booking.nightlyPriceSnapshot || 0),
    check_in: toIsoDate(booking.checkIn),
    check_out: toIsoDate(booking.checkOut),
    nights: Number(booking.nights || 0),
    subtotal_price: Number(booking.subtotalPrice || 0),
    tax_amount: Number(booking.gstAmount || 0),
    total_price: Number(booking.totalPrice || 0),
    status: booking.status || "confirmed",
    owner_seen: Boolean(booking.ownerSeen),
    created_at: toIsoDate(booking.createdAt),
    updated_at: toIsoDate(booking.updatedAt),
  };
};

const toGrpcError = (err) => {
  const statusByCode = {
    ABORTED: grpc.status.ABORTED,
    FAILED_PRECONDITION: grpc.status.FAILED_PRECONDITION,
    INVALID_ARGUMENT: grpc.status.INVALID_ARGUMENT,
    NOT_FOUND: grpc.status.NOT_FOUND,
    PERMISSION_DENIED: grpc.status.PERMISSION_DENIED,
  };

  return {
    code: statusByCode[err.code] || grpc.status.INTERNAL,
    message: err.message || "Unexpected booking service error",
  };
};

const wrapUnary = (handler) => async (call, callback) => {
  try {
    callback(null, await handler(call));
  } catch (err) {
    callback(toGrpcError(err));
  }
};

const implementation = {
  CreateBooking: wrapUnary(async (call) => {
    const booking = await bookingService.createBooking({
      listingId: call.request.listing_id,
      guestId: call.request.guest_id,
      guestName: call.request.guest_name,
      guestEmail: call.request.guest_email,
      checkIn: call.request.check_in,
      checkOut: call.request.check_out,
    });

    return { booking: toGrpcBooking(booking) };
  }),

  CancelBooking: wrapUnary(async (call) => {
    const booking = await bookingService.cancelBooking({
      bookingId: call.request.booking_id,
      requesterId: call.request.requester_id,
    });

    return { booking: toGrpcBooking(booking) };
  }),

  GetBooking: wrapUnary(async (call) => {
    const booking = await bookingService.getBookingForRequester({
      bookingId: call.request.booking_id,
      requesterId: call.request.requester_id,
    });

    return { booking: toGrpcBooking(booking) };
  }),

  GetGuestBookings: wrapUnary(async (call) => {
    const result = await bookingService.getGuestBookings({
      guestId: call.request.guest_id,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 100,
    });

    return {
      bookings: result.bookings.map(toGrpcBooking),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  GetOwnerBookings: wrapUnary(async (call) => {
    const result = await bookingService.getOwnerBookings({
      ownerId: call.request.owner_id,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 100,
    });

    return {
      bookings: result.bookings.map(toGrpcBooking),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  GetBookedDates: wrapUnary(async (call) => {
    return {
      booked_dates: await bookingService.getBookedDates(call.request.listing_id),
    };
  }),

  CheckAvailability: wrapUnary(async (call) => {
    return bookingService.checkAvailability({
      listingId: call.request.listing_id,
      checkIn: call.request.check_in,
      checkOut: call.request.check_out,
    });
  }),

  MarkOwnerSeen: wrapUnary(async (call) => {
    const booking = await bookingService.markBookingSeen({
      bookingId: call.request.booking_id,
      requesterId: call.request.owner_id,
    });

    return { booking: toGrpcBooking(booking) };
  }),
};

const createServer = () => {
  const server = new grpc.Server();
  server.addService(bookingProto.BookingService.service, implementation);
  return server;
};

module.exports = {
  createServer,
};
