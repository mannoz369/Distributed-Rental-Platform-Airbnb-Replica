# AWS EC2 Docker Compose Deployment

This is the recommended AWS path for the current architecture.

## Target Architecture

One EC2 instance runs Docker Compose:

```text
EC2 instance
  gateway:8080
  auth-service:50051
  listing-service:50052
  booking-service:50053
  review-service:50054
  notification-service:50055
  redpanda/kafka:9092/29092
  kafka-ui:8085 optional

MongoDB Atlas remains external.
Cloudinary remains external.
Mapbox remains external.
```

This reaches the main microservices vision:

- each service runs as its own container
- each service owns its own Atlas database
- gateway does not connect directly to MongoDB
- services communicate over gRPC
- booking publishes Kafka-compatible events
- notification consumes booking events

It does not reach the Kubernetes autoscaling vision yet. EC2 + Docker Compose is a single-host deployment. Kubernetes/HPA can come later using the existing `infra/k8s` manifests.

## Recommended EC2 Size

Kafka/Redpanda needs memory. Use at least:

```text
2 GB RAM minimum
4 GB RAM preferred
```

If only a tiny free-tier instance is available, set `KAFKA_ENABLED=false` for booking and notification at first.

## AWS Setup

1. Create an EC2 instance.
2. Use Ubuntu 22.04/24.04 LTS.
3. Choose a free-tier eligible instance if possible.
4. Storage: 20-30 GB gp3 is enough for a first deployment.
5. Security group inbound rules:

```text
22/tcp    your IP only
8080/tcp  0.0.0.0/0 for first test
8085/tcp  your IP only, optional Kafka UI
```

Later, put Nginx on ports 80/443 and close public 8080.

## Install Docker On EC2

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and SSH back in, then verify:

```bash
docker --version
docker compose version
```

## Clone And Configure

```bash
git clone https://github.com/mannoz369/Airbnb-Replica.git
cd Airbnb-Replica
```

Create service env files:

```bash
mkdir -p services/gateway services/auth-service services/listing-service services/booking-service services/review-service services/notification-service
nano services/gateway/.env
nano services/auth-service/.env
nano services/listing-service/.env
nano services/booking-service/.env
nano services/review-service/.env
nano services/notification-service/.env
```

Use Docker Compose service names for internal URLs:

```text
auth-service:50051
listing-service:50052
booking-service:50053
review-service:50054
notification-service:50055
kafka:29092
```

## Run

```bash
docker compose up --build -d
docker compose ps
```

Open:

```text
http://EC2_PUBLIC_IP:8080
```

Kafka UI, if exposed:

```text
http://EC2_PUBLIC_IP:8085
```

## Logs

```bash
docker compose logs --tail=120 gateway
docker compose logs --tail=120 auth-service
docker compose logs --tail=120 listing-service
docker compose logs --tail=120 booking-service
docker compose logs --tail=120 review-service
docker compose logs --tail=120 notification-service
docker compose logs --tail=120 kafka
```

## Stop

```bash
docker compose down
```

Avoid deleting volumes unless intentional:

```bash
docker compose down -v
```
