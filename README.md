# Wanderlust Airbnb Replica

Wanderlust is an Airbnb-style booking application that started as an Express, EJS, MongoDB, and Mongoose monolith and has been migrated toward a microservices architecture.

The project now runs as a set of containerized services behind a gateway, with service-owned MongoDB Atlas databases, gRPC service communication, and Kafka-compatible booking events through Redpanda.

## Current Status

The application is deployed on AWS EC2 using Docker Compose.

This deployment runs the same service topology that was tested locally:

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

Kubernetes manifests were designed for Oracle Cloud Infrastructure Kubernetes Engine in `infra/k8s`, including Deployments, ClusterIP services, a gateway LoadBalancer, Redpanda, and HPA definitions. Oracle Cloud Always Free node provisioning failed because the selected region had no available `VM.Standard.A1.Flex` capacity, so the live deployment was moved to AWS EC2.

## Architecture

```text
Browser
  -> Gateway
  -> Auth Service
  -> Listing Service
  -> Booking Service
  -> Review Service
  -> Notification Service

Booking Service
  -> Redpanda/Kafka booking events
  -> Notification Service consumer

Each service
  -> its own MongoDB Atlas database
```

The gateway no longer connects directly to MongoDB. It renders the EJS UI and calls backend services through gRPC clients.

## Services

- `gateway`: public web entry point, EJS rendering, Cloudinary uploads, service composition.
- `auth-service`: user registration, login, refresh tokens, JWT validation.
- `listing-service`: listing CRUD, listing search, ownership checks, Mapbox geocoding.
- `booking-service`: booking creation, cancellation, owner/guest booking reads, Kafka event publishing.
- `review-service`: review creation/deletion and listing review reads.
- `notification-service`: consumes booking events and stores owner notifications.
- `redpanda`: Kafka-compatible broker for local/EC2 deployment.

## Tech Stack

- Node.js
- Express
- EJS
- MongoDB Atlas
- Mongoose
- gRPC with `@grpc/grpc-js`
- Redpanda/Kafka with `kafkajs`
- Docker and Docker Compose
- Cloudinary for listing images
- Mapbox for geocoding
- Kubernetes manifests prepared for future managed-cluster deployment

## Database Design

The app uses one MongoDB Atlas cluster with multiple service-owned databases:

```text
auth-db
listing-db
booking-db
review-db
notification-db
```

Services do not fall back to a shared monolith database. Each service requires its own `*_DB_URL`.

## Local Or EC2 Docker Compose

Create ignored service env files:

```text
services/gateway/.env
services/auth-service/.env
services/listing-service/.env
services/booking-service/.env
services/review-service/.env
services/notification-service/.env
```

Start the stack:

```bash
docker compose up --build -d
docker compose ps
```

Stop:

```bash
docker compose down
```

Avoid deleting volumes unless intentional:

```bash
docker compose down -v
```

## Required Environment Variables

Gateway:

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

Services:

```env
AUTH_DB_URL=
LISTING_DB_URL=
BOOKING_DB_URL=
REVIEW_DB_URL=
NOTIFICATION_DB_URL=
KAFKA_BROKERS=kafka:29092
KAFKA_ENABLED=true
```

`MAP_TOKEN` is also required by `listing-service`.

## Data Migration

A copy-only Atlas migration script is available:

```bash
npm run migrate:atlas:dry-run
npm run migrate:atlas
```

The script copies existing collections into service-owned Atlas databases while preserving `_id` values. It does not delete source data.

## Kubernetes Work

Kubernetes resources live in:

```text
infra/k8s
```

They include:

- Namespace
- ConfigMap
- Secret example
- Gateway LoadBalancer service
- Internal ClusterIP services
- Deployments
- Redpanda deployment
- HPAs with 90% CPU target

These manifests were prepared for OCI/OKE first. Because Oracle free-tier A1 capacity was unavailable in the selected region, Kubernetes deployment was paused and AWS EC2 Docker Compose was used for the live cloud deployment.

The intended future Kubernetes architecture is:

```text
Load Balancer
  -> Gateway pods
  -> ClusterIP services
  -> Auth/Listings/Bookings/Reviews/Notifications pods
  -> MongoDB Atlas

Booking pods
  -> Managed Kafka/Redpanda
  -> Notification consumer pods

HPA
  -> scale pods by CPU and later Kafka lag
```

## Deployment Docs

- AWS EC2 Docker Compose: `docs/aws-ec2-docker-compose-deployment.md`
- Oracle Kubernetes plan: `docs/oracle-cloud-kubernetes-deployment.md`
- Migration plan: `microservices-migration-plan.md`

## Features

- Browse stays
- Search listings by location/country
- Host listing creation and management
- Cloudinary image upload
- User signup/login with JWT cookies
- Booking creation and cancellation
- Guest booking history
- Owner booking notifications
- Reviews and ratings

## Project Notes

This repo intentionally shows the migration path from monolith to microservices. The current production-like deployment is Docker Compose on EC2, while the Kubernetes design is prepared for a future managed Kubernetes environment when budget and cloud capacity allow it.

## License

This project is licensed under the [MIT License](LICENSE).

Made by Manoj.
