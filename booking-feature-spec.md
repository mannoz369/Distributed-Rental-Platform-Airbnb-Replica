# Booking Feature

## Why

Guests need a clear way to book available listings, and owners need visibility when their properties are booked. The app currently supports listings, reviews, and auth, but it has no reservation workflow or booking history.

## What

Add authenticated booking for non-owner users: show a booking button/form on listing pages, prefill the logged-in user's name and email, validate check-in/check-out dates, calculate total price from the listing nightly price, prevent overlapping active bookings, save bookings to MongoDB, show confirmation, notify owners through the navbar, let owners view booking details, and let guests view/cancel their bookings with a typed `confirm` step.

## Constraints

### Must
- Follow existing Express, Mongoose, Passport, Joi, controller, route, EJS, Bootstrap, and flash-message patterns.
- Keep booking routes authenticated.
- Prevent owners from booking their own listings.
- Treat cancelled bookings as history and exclude them from availability checks.
- Calculate final totals on the backend, even when the frontend displays an estimate.

### Must Not
- Add new dependencies.
- Modify unrelated listing/review/auth behavior.
- Trust user-submitted name, email, nightly price, or total price.

### Out of Scope
- Payments.
- Email delivery.
- Per-listing blocked dates managed manually by owners.

## Current State

The app is an Express/Mongo/EJS Airbnb-style project with Passport sessions. Listings have an `owner`, `price`, reviews, and a show page. There are existing middleware helpers for authentication, owner checks, and Joi validation.

- Relevant files: `app.js`
- Relevant files: `models/listing.js`
- Relevant files: `models/user.js`
- Relevant files: `routes/listing.js`
- Relevant files: `controllers/listings.js`
- Relevant files: `middleware.js`
- Relevant files: `schema.js`
- Relevant files: `views/includes/navbar.ejs`
- Relevant files: `views/listings/show.ejs`
- Relevant files: `public/js/script.js`
- Relevant files: `public/css/style.css`

## Tasks

### T1: Booking Data And Validation
**What:** Add a Booking model with listing, guest, owner, guestName, guestEmail, checkIn, checkOut, nights, totalPrice, status, and timestamps. Add Joi validation for booking and cancellation confirmation. Add middleware helpers for booking validation and booking authorization.
**Files:** `models/booking.js`, `models/listing.js`, `schema.js`, `middleware.js`
**Verify:** Start the app and create invalid booking payloads to confirm server-side flash errors instead of saved bookings.

### T2: Booking Routes And Controller
**What:** Add booking routes for create, confirmation, guest bookings, owner notifications, owner booking details, and cancellation. Enforce non-owner booking, date overlap checks, backend total calculation, and cancellation.
**Files:** `routes/booking.js`, `controllers/bookings.js`, `app.js`
**Verify:** Book an available date range, verify a Booking document is saved, try the same date range as another user, and confirm the overlap is rejected.

### T3: Listing Page Booking UI
**What:** On listing show pages, display the booking form only to logged-in non-owner users, prefill readonly user name/email, show required check-in/check-out fields, estimate total price on the frontend, and render a compact availability calendar with red markers for booked dates.
**Files:** `controllers/listings.js`, `views/listings/show.ejs`, `public/js/script.js`, `public/css/style.css`
**Verify:** Owner sees edit/delete only; logged-out users do not see the form; logged-in non-owner users see the form and live total.

### T4: Booking History And Notifications UI
**What:** Add navbar notification and bookings links, owner notification list/detail pages, booking confirmation page, guest booking history, and cancel confirmation form.
**Files:** `views/includes/navbar.ejs`, `views/bookings/confirmation.ejs`, `views/bookings/my-bookings.ejs`, `views/bookings/owner-notifications.ejs`, `views/bookings/owner-show.ejs`, `views/bookings/cancel.ejs`
**Verify:** Owner sees active booking count in navbar, can inspect booking details, and guest can cancel only after typing `confirm`.

## Validation

- `node -c app.js`
- `node -c controllers/bookings.js`
- `node -c middleware.js`
- Manual check: create a booking, see confirmation, owner notification, guest bookings page, unavailable red-dot dates, overlap rejection, and cancellation status update.
