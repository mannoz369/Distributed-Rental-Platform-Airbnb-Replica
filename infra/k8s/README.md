# Oracle Cloud Kubernetes Deployment

This folder prepares the app for Oracle Cloud Infrastructure Kubernetes Engine.

## What Runs In Kubernetes

- Gateway as a public `LoadBalancer` service.
- Auth, Listing, Booking, Review, and Notification services as internal `ClusterIP` services.
- One lightweight Redpanda broker for Kafka-compatible local cluster messaging.
- HorizontalPodAutoscalers with a 90% CPU target.

MongoDB stays in Atlas. Cloudinary and Mapbox stay external.

## Before Applying

1. Replace image placeholders in `deployments.yaml`:

   ```text
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-gateway:latest
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-auth-service:latest
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-listing-service:latest
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-booking-service:latest
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-review-service:latest
   ghcr.io/YOUR_GITHUB_USERNAME/airbnb-replica-notification-service:latest
   ```

2. Create the namespace:

   ```bash
   kubectl apply -f infra/k8s/namespace.yaml
   ```

3. Create secrets without committing them:

   ```bash
   cp infra/k8s/secrets.example.yaml infra/k8s/secrets.yaml
   # edit infra/k8s/secrets.yaml
   kubectl apply -f infra/k8s/secrets.yaml
   ```

4. Apply the manifests:

   ```bash
   kubectl apply -k infra/k8s
   ```

5. Watch rollout:

   ```bash
   kubectl get pods -n airbnb-replica -w
   kubectl get svc -n airbnb-replica
   kubectl get hpa -n airbnb-replica
   ```

## Notes

- `redpanda` uses `emptyDir`, so Kafka data is not durable. This is fine for a first free-tier deployment, but not for production.
- HPAs require the Kubernetes metrics server to be installed and working.
- The gateway service uses OCI Load Balancer annotations with the smallest flexible shape.
- The Docker workflow builds `linux/arm64` images for Oracle Ampere A1 nodes.
