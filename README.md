# Spyglass - Saltbox Dashboard

A beautiful, modern React dashboard for managing and monitoring your Saltbox server.

## Features

- **Server Analytics**: Real-time monitoring of CPU, Memory, Disk, and Network usage
- **Docker App Management**: Visual grid of all Saltbox applications with start/stop/restart controls
- **Saltbox CLI Integration**: Quick access to common Saltbox commands
- **Modern UI**: Sleek glassmorphism design with Tailwind CSS
- **Responsive**: Works beautifully on all screen sizes

## Installation

```bash
npm install
```

## Development

Run both backend and frontend servers:
```bash
npm run dev
```

This will start:
- Backend API: `http://localhost:3000/api`
- Frontend: `http://localhost:5173` (proxies API calls to backend)

You can also run them separately:
- `npm run dev:backend` - Backend only
- `npm run dev:frontend` - Frontend only

## Building for Production

```bash
npm run build
```

## Backend API

The backend server (`server.js`) provides the following endpoints:

- `GET /api/server/stats` - Real-time server statistics (CPU, memory, disk, network)
- `GET /api/docker/apps` - List of all Docker containers with status
- `POST /api/docker/:appId/:action` - Control Docker containers (start/stop/restart)
- `POST /api/saltbox/command` - Execute Saltbox CLI commands

The backend connects directly to the Docker socket at `/var/run/docker.sock` and uses `systeminformation` for server metrics.

## Docker Socket Permissions

Make sure the user running Spyglass has access to the Docker socket:

```bash
sudo usermod -aG docker $USER
```

Or run with appropriate permissions to access `/var/run/docker.sock`.

## License

MIT

