# Oracle Cloud Kubernetes Deployment Plan

This is the intended free/low-cost path for deploying the Airbnb Replica microservices on cloud Kubernetes.

## Target Shape

- Oracle Cloud Infrastructure account.
- OKE Basic Kubernetes cluster.
- Ampere A1 Always Free worker nodes when available.
- MongoDB Atlas for service-owned databases.
- Cloudinary for listing images.
- Mapbox for geocoding.
- Redpanda inside Kubernetes for the first Kafka-compatible deployment.
- GitHub Container Registry for Docker images.

## Step 1: Prepare Cloud Accounts

1. Create or open your Oracle Cloud account.
2. Choose the home region carefully. Always Free resources are tied to the home region.
3. Create or keep your MongoDB Atlas cluster.
4. In MongoDB Atlas Network Access, allow the Oracle worker node outbound IP.
   - For first testing only, you can temporarily allow `0.0.0.0/0`.
   - Tighten this once you know the Oracle egress IP.
5. Keep Cloudinary and Mapbox credentials ready.

## Step 2: Push Code And Build Images

1. Push the repository to GitHub.
2. GitHub Actions will build these images:
   - `airbnb-replica-gateway`
   - `airbnb-replica-auth-service`
   - `airbnb-replica-listing-service`
   - `airbnb-replica-booking-service`
   - `airbnb-replica-review-service`
   - `airbnb-replica-notification-service`
3. The workflow publishes multi-architecture images for:
   - `linux/amd64`
   - `linux/arm64`

This matters because Oracle Always Free Ampere nodes are ARM.

## Step 3: Make GHCR Images Pullable

For the simplest first deployment, make the GHCR packages public.

If you keep them private, create an image pull secret:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --namespace airbnb-replica \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=YOUR_EMAIL
```

Then add `imagePullSecrets` to the Kubernetes deployments.

## Step 4: Create OKE Cluster

In Oracle Cloud Console:

1. Go to Kubernetes Clusters / OKE.
2. Create a Basic cluster.
3. Use managed worker nodes.
4. Choose an Always Free eligible Ampere A1 shape if available.
5. Keep the node pool small:
   - 1 node for first deployment.
   - 2 nodes if capacity allows.
6. Install or configure `kubectl` with the kubeconfig command Oracle provides.

## Step 5: Install Metrics Server

HPAs need metrics server.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl get deployment metrics-server -n kube-system
```

## Step 6: Update Image Names

Edit `infra/k8s/deployments.yaml` and replace:

```text
ghcr.io/YOUR_GITHUB_USERNAME
```

with your lowercase GitHub username or organization.

## Step 7: Create Kubernetes Secrets

```bash
kubectl apply -f infra/k8s/namespace.yaml
cp infra/k8s/secrets.example.yaml infra/k8s/secrets.yaml
```

Edit `infra/k8s/secrets.yaml` with real values.

Then apply it:

```bash
kubectl apply -f infra/k8s/secrets.yaml
```

Do not commit `infra/k8s/secrets.yaml`.

## Step 8: Deploy

```bash
kubectl apply -k infra/k8s
```

Watch:

```bash
kubectl get pods -n airbnb-replica -w
kubectl get svc -n airbnb-replica
kubectl get hpa -n airbnb-replica
```

When the gateway service receives an external IP, open it in the browser.

## Step 9: Debug Commands

```bash
kubectl get pods -n airbnb-replica
kubectl describe pod POD_NAME -n airbnb-replica
kubectl logs deployment/gateway -n airbnb-replica
kubectl logs deployment/auth-service -n airbnb-replica
kubectl logs deployment/listing-service -n airbnb-replica
kubectl logs deployment/booking-service -n airbnb-replica
kubectl logs deployment/review-service -n airbnb-replica
kubectl logs deployment/notification-service -n airbnb-replica
kubectl logs deployment/redpanda -n airbnb-replica
```

## Cost Guardrails

- Use OKE Basic, not Enhanced, for the free-first path.
- Use Always Free eligible worker shapes only.
- Keep only one LoadBalancer while testing.
- Keep MongoDB in Atlas.
- Do not create paid NAT gateways or extra block volumes unless you intend to pay.
- Delete the cluster when you are done experimenting if you are unsure about billing.
