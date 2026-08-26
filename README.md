# Wanderlust Airbnb Replica

Wanderlust is an Airbnb-style booking application that began as an Express, EJS, MongoDB, and Mongoose monolith. The project has now been migrated into a production-oriented microservices system with containerized services, service-owned MongoDB Atlas databases, gRPC contracts, Kafka-compatible booking events, and cloud deployment documentation.

The original app supported browsing listings, host listing management, authentication, reviews, Cloudinary images, and Mapbox-powered locations. This branch extends that foundation with bookings, owner notifications, service extraction, Docker Compose deployment, Kubernetes manifests, and migration tooling.

Live - http://13.53.140.232:8080/listings

## What We Achieved

- Migrated the monolith into a gateway plus five backend services: auth, listing, booking, review, and notification.
- Moved service communication behind shared gRPC proto contracts in `packages/proto`.
- Added booking creation, cancellation, guest booking history, owner booking views, and owner notifications.
- Added Redpanda/Kafka event publishing from the booking service and notification consumption in the notification service.
- Split MongoDB Atlas usage into service-owned databases instead of relying on one shared monolith database.
- Added Dockerfiles for every runtime service and a full `docker-compose.yml` stack with health checks.
- Prepared Kubernetes manifests under `infra/k8s` for a future managed-cluster deployment.
- Documented the AWS EC2 Docker Compose deployment and the Oracle Cloud Kubernetes deployment attempt.
- Added a copy-only Atlas migration script for moving existing data into service-owned databases.
- Reorganized gateway code into domain modules under `src/domains` with shared middleware, errors, config, and gRPC clients.
- Added architecture, service-flow, gRPC-contract, deployment, migration, and decision documentation.
- Added benchmark scripts for listing-service gRPC calls and Kafka booking-event throughput.

## Current Status

The application is deployed on AWS EC2 using Docker Compose.

This deployment runs the same topology that was tested locally:

```text
EC2 instance
  gateway
  auth-service
  listing-service
  booking-service
  review-service
  notification-service
  redpanda/kafka
  kafka-ui optional

MongoDB Atlas
  auth-db
  listing-db
  booking-db
  review-db
  notification-db
```

Kubernetes manifests were designed for Oracle Cloud Infrastructure Kubernetes Engine in `infra/k8s`, including Deployments, ClusterIP services, a gateway LoadBalancer, Redpanda, and HPA definitions. Oracle Cloud Always Free node provisioning failed because the selected region had no available `VM.Standard.A1.Flex` capacity, so the live deployment moved to AWS EC2 with Docker Compose.

## Architecture

```text
Browser
  -> Gateway
      -> Auth Service over gRPC
      -> Listing Service over gRPC
      -> Booking Service over gRPC
      -> Review Service over gRPC
      -> Notification Service over gRPC

Booking Service
  -> Redpanda/Kafka booking events
  -> Notification Service consumer

Each service
  -> its own MongoDB Atlas database
```

The gateway renders the EJS UI and composes backend responses through gRPC clients. It no longer connects directly to MongoDB for the migrated service flows.

## Services

- `gateway`: public web entry point, EJS rendering, Cloudinary uploads, session/JWT cookie handling, and service composition.
- `auth-service`: user registration, login, refresh tokens, JWT validation, and user lookups.
- `listing-service`: listing CRUD, search, ownership checks, and Mapbox geocoding.
- `booking-service`: booking creation, cancellation, owner/guest booking reads, listing availability checks, and Kafka event publishing.
- `review-service`: review creation, deletion, and listing review reads.
- `notification-service`: booking-event consumer, owner notification storage, and notification reads.
- `redpanda`: Kafka-compatible broker used by local and EC2 Docker Compose deployments.

## Features

- Browse stays and view listing details.
- Search listings by location or country.
- Sign up, log in, and maintain authenticated sessions.
- Create, edit, and delete owned listings.
- Upload listing images through Cloudinary.
- View listing locations through Mapbox.
- Create and cancel bookings.
- View guest booking history.
- View owner bookings and booking notifications.
- Create and delete listing reviews with ratings.

## Tech Stack

- Node.js 20
- Express
- EJS and EJS Mate
- MongoDB Atlas
- Mongoose
- gRPC with `@grpc/grpc-js` and `@grpc/proto-loader`
- Redpanda/Kafka with `kafkajs`
- Docker and Docker Compose
- Kubernetes manifests with Kustomize
- Cloudinary for listing images
- Mapbox for geocoding and maps
- GitHub Actions for multi-architecture Docker image builds

## Repository Layout

```text
app.js                         Gateway entry point
src/app.js                     Gateway app composition
src/domains                    Gateway domain controllers, services, routes, validation, and gRPC clients
services/*                     Standalone backend microservices
packages/proto                 Shared gRPC contracts
packages/common                Shared Kafka, auth-context, logger, and error notes
views                          EJS pages and partials
public                         CSS and browser JavaScript
scripts                        Migration and benchmark utilities
docs                           Architecture, flow, and deployment documentation
infra/k8s                      Kubernetes resources
docker-compose.yml             Local/EC2 service stack
```

## Environment

Start from `.env.example` and create ignored service env files:

```text
services/gateway/.env
services/auth-service/.env
services/listing-service/.env
services/booking-service/.env
services/review-service/.env
services/notification-service/.env
```

Gateway variables:

```env
CLOUD_NAME=
CLOUD_API_KEY=
CLOUD_API_SCRETE=
MAP_TOKEN=
SCRETE=
JWT_SECRET=
COOKIE_SECURE=false
AUTH_SERVICE_URL=auth-service:50051
LISTING_SERVICE_URL=listing-service:50052
BOOKING_SERVICE_URL=booking-service:50053
REVIEW_SERVICE_URL=review-service:50054
NOTIFICATION_SERVICE_URL=notification-service:50055
```

Service variables:

```env
AUTH_DB_URL=
LISTING_DB_URL=
BOOKING_DB_URL=
REVIEW_DB_URL=
NOTIFICATION_DB_URL=
KAFKA_BROKERS=kafka:29092
KAFKA_ENABLED=true
```

`MAP_TOKEN` is also required by `listing-service` because listing creation performs geocoding.

## Run With Docker Compose

Build and start the full stack:

```bash
npm run compose:up
```

Or run Docker Compose directly:

```bash
docker compose up --build -d
docker compose ps
```

Open the gateway on:

```text
http://localhost:8080/listings
```

Kafka UI is available when the stack is running:

```text
http://localhost:8085
```

Stop the stack:

```bash
npm run compose:down
```

Avoid deleting Docker volumes unless you intentionally want to remove Redpanda data:

```bash
docker compose down -v
```

## Run Services Manually

Install dependencies:

```bash
npm install
```

Start services in separate terminals after configuring local env values:

```bash
npm run auth-service
npm run listing-service
npm run booking-service
npm run review-service
npm run notification-service
npm start
```

For manual local runs, service URLs usually point to `localhost` ports and `KAFKA_BROKERS` usually points to `localhost:9092`.

## Data Migration

A copy-only Atlas migration script is available:

```bash
npm run migrate:atlas:dry-run
npm run migrate:atlas
```

The script copies existing monolith collections into service-owned Atlas databases while preserving `_id` values. It does not delete source data.

Required migration variables:

```env
MIGRATION_SOURCE_DB_URL=
AUTH_DB_URL=
LISTING_DB_URL=
BOOKING_DB_URL=
REVIEW_DB_URL=
NOTIFICATION_DB_URL=
```

## Benchmarks

The branch includes lightweight benchmarking scripts for the new service communication paths.

Listing gRPC benchmark:

```bash
node scripts/bench-grpc-listings.js
```

Useful overrides:

```bash
GRPC_TARGET=localhost:50052 CONCURRENCY=200 DURATION=60 DEADLINE_MS=10000 node scripts/bench-grpc-listings.js
```

Kafka booking-event benchmark:

```bash
node scripts/bench-kafka-booking-events.js
```

Useful overrides:

```bash
KAFKA_BROKERS=localhost:9092 MESSAGES=1000 BATCH_SIZE=100 node scripts/bench-kafka-booking-events.js
```

## Kubernetes Work

Kubernetes resources live in `infra/k8s` and include:

- Namespace
- ConfigMap
- Secret example
- Gateway LoadBalancer service
- Internal ClusterIP services
- Service Deployments
- Redpanda deployment
- HPAs with 90% CPU target

Apply the manifests:

```bash
npm run k8s:apply
```

Delete them:

```bash
npm run k8s:delete
```

The intended future Kubernetes architecture is:

```text
Load Balancer
  -> Gateway pods
  -> ClusterIP services
  -> Auth/Listings/Bookings/Reviews/Notifications pods
  -> MongoDB Atlas

Booking pods
  -> Managed Kafka or Redpanda
  -> Notification consumer pods

HPA
  -> scale pods by CPU and later Kafka lag
```

## Documentation

- `microservices-migration-plan.md`: full migration plan and phased work.
- `booking-feature-spec.md`: booking feature scope and implementation notes.
- `docs/auth-service-flow.md`: auth service execution flow.
- `docs/listing-service-flow.md`: listing service execution flow.
- `docs/booking-service-flow.md`: booking service execution flow.
- `docs/review-service-flow.md`: review service execution flow.
- `docs/grpc-contract-flow.md`: shared gRPC contract flow.
- `docs/aws-ec2-docker-compose-deployment.md`: EC2 deployment steps.
- `docs/oracle-cloud-kubernetes-deployment.md`: OCI Kubernetes plan and capacity result.
- `infra/k8s/README.md`: Kubernetes manifest notes.
- `Decision.md`: decision log for meaningful implementation choices.
- `FLOW.MD`: project execution-flow documentation standard.

## Deployment Notes

The current production-like deployment path is AWS EC2 with Docker Compose. The Kubernetes design remains ready for a future managed Kubernetes environment when cloud capacity and budget allow it.

Docker image publishing is prepared through `.github/workflows/docker-images.yml`, which builds gateway and service images for `linux/amd64` and `linux/arm64` and pushes them to GitHub Container Registry on `main` pushes or manual workflow dispatch.

## License

This project is licensed under the [MIT License](LICENSE).

Made by Manoj.
