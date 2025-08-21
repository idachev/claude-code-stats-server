# Required GitHub Secrets for Docker Build and Push Action

To enable the automated Docker build and push workflow, you need to configure the following secrets in your GitHub repository:

## Required Secrets

### `DOCKER_USERNAME`
- **Description**: Your Docker Hub username
- **Value**: Your Docker Hub account username (e.g., `idachev`)

### `DOCKER_PASSWORD`
- **Description**: Your Docker Hub password or access token
- **Value**: Your Docker Hub password or preferably a Docker Hub access token
- **Note**: For security, use a Docker Hub access token instead of your password

### `DOCKER_IMAGE_NAME`
- **Description**: The name of your Docker image (without the username prefix)
- **Value**: The image name (e.g., `claude-code-stats-server`)

## How to Set Up Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the name and value as specified above

## Docker Hub Access Token Setup (Recommended)

Instead of using your Docker Hub password, create an access token:

1. Log in to Docker Hub
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Give it a descriptive name (e.g., "GitHub Actions")
5. Set appropriate permissions (Read, Write, Delete)
6. Copy the generated token and use it as the `DOCKER_PASSWORD` secret

## Workflow Trigger

The workflow will:
- Run automatically on pushes to the `release` branch
- Can be triggered manually from the Actions tab
- Automatically increment the patch version from the latest git tag
- Build and push with both the new version tag and `latest` tag

## Docker Image Naming

The built images will be pushed to Docker Hub with the following naming pattern:
- `<DOCKER_USERNAME>/<DOCKER_IMAGE_NAME>:<version>` (e.g., `idachev/claude-code-stats-server:0.1.1`)
- `<DOCKER_USERNAME>/<DOCKER_IMAGE_NAME>:latest` (e.g., `idachev/claude-code-stats-server:latest`)

## Environment Variables

The workflow uses the following environment variables (set automatically from secrets):
- `IGD_UTILS_REMOTE_DOCKER_USER`: Maps to `DOCKER_USERNAME` secret
- `IGD_UTILS_DOCKER_IMG`: Maps to `DOCKER_IMAGE_NAME` secret
- `IGD_UTILS_DOCKER_TAG`: Default value is `latest`

These variables are compatible with the existing `docker-push.sh` script in the repository.