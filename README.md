# AI-Powered Event Management System with QR-Based Attendance

A full-stack web application for planning, managing, conducting, and analyzing events.

The system helps organizers manage events from pre-event planning to post-event analysis. It provides online registration, QR-based attendance, feedback analysis, certificates, notifications, and event analytics.

## Features

- User, Organiser, and Admin roles
- User registration and login
- Event creation and management
- Pre-event planning and task management
- AI-assisted event planning
- Individual and team registration
- QR-based attendance tracking
- Attendance CSV export
- Automatic event status updates
- Feedback collection
- AI-based sentiment analysis
- Event analytics and reports
- Automated certificate generation
- Notifications
- AI-based recommendations for completed events
- User, Organiser, and Admin profiles
- Settings management
- Responsive design
- Home page event discovery and navigation

## User Roles

### Admin

- Manage users and organisers
- Manage events
- View event statistics and reports
- View attendance and analytics

### Organiser

- Create and manage events
- Plan event activities and resources
- Manage participants and teams
- Track attendance
- Download attendance sheets
- View feedback and analytics
- Generate certificates
- View AI-based event improvement recommendations

### User / Participant

- Browse events
- Register for events
- Register individually or as a team member
- View registered events
- Use QR-based attendance
- View certificates
- Submit feedback
- Manage profile and settings

## Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Zustand
- React Router

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcrypt

### AI Service

- Python
- FastAPI
- Transformers / NLP
- Sentiment Analysis

## Project Structure

```text
event-management-system/
├── frontend/
├── backend/
├── ai-service/
└── README.md
```

## Installation and Setup

### 1. Start MongoDB

Make sure MongoDB is running.

Database name:

```text
event_management_system
```

### 2. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend URL: <http://localhost:5000>

### 3. Start AI Service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

AI service URL: <http://127.0.0.1:8000>

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: <http://localhost:5173>

## Default Test Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@gmail.com | admin@123 |
| Organiser | organiser@gmail.com | organiser@123 |
| User | user@gmail.com | user@123 |

> Change the default passwords before using the application in a real deployment.

## Event Status

Events automatically move through the following lifecycle:

```text
UPCOMING → ONGOING → COMPLETED
```

Cancelled events are marked as:

```text
CANCELLED
```

QR attendance follows the event's attendance rules and status.

## Important Notes

- The project uses the MongoDB database `event_management_system`.
- Free/Paid event creation is not included in the current project scope.
- AI event improvement recommendations are based on available event data.
- The project is developed as an academic major project.

## Future Scope

- Advanced AI-based event prediction
- More detailed cross-event analytics
- Improved notification services
- Advanced resource and budget planning
- Additional AI-powered event recommendations
- Cloud deployment and production optimization

## Project Status

The current version includes event planning, registration, team registration, QR attendance, analytics, feedback, certificates, notifications, AI assistance, attendance export, user dashboard, profiles, settings, and responsive UI.

## Docker Deployment and Project Lab Verification

This section provides the end-to-end operational guide for deploying and demonstrating EventFlow on college Project Lab computers using Docker and Docker Compose.

---

### 1. Project Overview and Architecture

EventFlow is orchestrated as a multi-container system connected via an internal bridge network (`eventflow-network`):

```text
[ Browser / Lab Client ]
       │
       ├─── http://localhost:5173 ──► [ frontend: Nginx 1.27 + React 19 SPA ]
       │                                     │
       └─── http://localhost:5000 ──► [ backend: Node.js 20 Express API ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ mongodb: Mongo 7.0 ]                   [ ai-service: FastAPI ]
          (eventflow_mongodb_data volume)                (rule-based + VADER)
```

- **Frontend Container (`eventflow-frontend`)**: Serves the optimized production build of the React/Vite application via Nginx on port `5173`. Handles client-side SPA routing and proxies `/api` requests.
- **Backend Container (`eventflow-backend`)**: Node.js/Express REST API on port `5000`. Handles JWT authentication (HTTP-only cookies), role-based authorization, business logic, QR verification, and PDF rendering.
- **AI Service Container (`eventflow-ai-service`)**: Python 3.11/FastAPI service running on port `8000` (internal). Implements rule-based planning analysis, VADER sentiment analysis, and post-event recommendations without heavy ML dependencies.
- **Database Container (`eventflow-mongodb`)**: Official MongoDB 7.0 database using database name `event_management_system` backed by persistent named volume `eventflow_mongodb_data`.

---

### 2. Prerequisites

The lab host computer requires:
- **Operating System**: Windows 10/11 (64-bit), macOS, or Linux.
- **Docker Desktop** (or Docker Engine + Docker Compose v2+).
  > **Windows Lab Requirement**: Docker Desktop on Windows requires **WSL 2** (Windows Subsystem for Linux). If Docker Desktop displays an engine failure, open PowerShell as Administrator and run:
  > ```powershell
  > wsl --install
  > ```
  > Then restart the computer and launch Docker Desktop.
- **Web Browser**: Google Chrome, Mozilla Firefox, or Microsoft Edge.
- **Internet Access**: Required only for initial Docker image download (`node:20-alpine`, `nginx:1.27-alpine`, `python:3.11-slim`, `mongo:7.0`). Once built, no internet connection is required.

---

### 3. Repository Cloning and Setup

Clone the project repository to the lab computer:

```bash
git clone https://github.com/MohammadNajreAlam786/Event_Management_System.git Event-Management-system
cd Event-Management-system
```

---

### 4. Environment Configuration

Copy the template to create the root `.env` file:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Generate a secure random secret for `JWT_SECRET` (optional in dev, required in production):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Verify that `.env` contains:
```ini
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/event_management_system
MONGODB_DB_NAME=event_management_system
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000/api
JWT_SECRET=your_generated_or_provided_jwt_secret
JWT_EXPIRES_IN=1d
AUTH_COOKIE_NAME=em_token
COOKIE_SECURE=false
AI_SERVICE_URL=http://ai-service:8000
AI_TIMEOUT_MS=20000
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin@123
```

---

### 5. First-Time Docker Build and Startup

Build the container images and launch all services in detached mode:

```bash
docker compose up --build -d
```

Docker Compose will:
1. Pull base images (`mongo:7.0`, `node:20-alpine`, `nginx:1.27-alpine`, `python:3.11-slim`).
2. Build the AI service container and run dependency installations.
3. Build the backend container with production dependencies.
4. Build the frontend production bundle via Vite and embed it into Nginx.
5. Create the network `eventflow-network` and volume `eventflow_mongodb_data`.
6. Start MongoDB and wait for its health check to pass.
7. Start AI service and wait for its readiness check to pass.
8. Start Backend and wait for its API health check to pass.
9. Start Frontend and expose port `5173`.

---

### 6. Checking Container Health

View the running status and health of all containers:

```bash
docker compose ps
```

Expected status:
```text
NAME                     IMAGE               COMMAND                  SERVICE      STATUS                    PORTS
eventflow-mongodb        mongo:7.0           "docker-entrypoint.s…"   mongodb      Up (healthy)              0.0.0.0:27017->27017/tcp
eventflow-ai-service     ai-service          "uvicorn main:app --…"   ai-service   Up (healthy)              8000/tcp
eventflow-backend        backend             "node src/server.js"     backend      Up (healthy)              0.0.0.0:5000->5000/tcp
eventflow-frontend       frontend            "nginx -g 'daemon of…"   frontend     Up (healthy)              0.0.0.0:5173->80/tcp
```

---

### 7. Application URLs and Exposed Ports

| Component | URL / Endpoint | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | <http://localhost:5173> | User interface (Home, Dashboard, QR Scanner) |
| **Backend API** | <http://localhost:5000/api> | REST API base URL |
| **Backend Health Probe**| <http://localhost:5000/api/health> | System and DB connectivity probe |
| **MongoDB Database** | `mongodb://localhost:27017` | Local DB inspection (Compass / mongosh) |

---

### 8. Viewing Service Logs

To monitor container output in real time:

```bash
# View logs from all services:
docker compose logs -f

# View backend logs only:
docker compose logs -f backend

# View AI service logs only:
docker compose logs -f ai-service

# View MongoDB logs:
docker compose logs -f mongodb
```

---

### 9. Restarting Services

To restart individual containers without restarting the entire stack:

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart ai-service
```

---

### 10. Stopping Services Safely

To shut down containers cleanly while **preserving all database data**:

```bash
docker compose down
```

> ⚠️ **CRITICAL DATA SAFETY RULE**:
> **Never run `docker compose down -v`** on a lab machine containing project demonstration data.
> The `-v` flag deletes named persistent volumes, including `eventflow_mongodb_data`.
> Plain `docker compose down` stops and removes containers safely while keeping the volume intact.

---

### 11. Rebuilding Images

If frontend or backend code is updated:

```bash
# Rebuild and restart in the background (database volume is unaffected):
docker compose up -d --build
```

---

### 12. Verifying Database Persistence

To prove that project data survives restarts and rebuilds:
1. Log in and create an event or register a user.
2. Stop the application:
   ```bash
   docker compose down
   ```
3. Restart the application:
   ```bash
   docker compose up -d
   ```
4. Refresh <http://localhost:5173> and verify that all events, users, registrations, and certificates remain intact.
5. Rebuild images with `docker compose up -d --build` and verify data still persists.

---

### 13. Initializing Demonstration Accounts

EventFlow provides idempotent provisioning scripts that can be safely run inside the backend container without risking duplicate accounts:

```bash
# Seed all 3 default test accounts (Admin, Organiser, User):
docker compose exec backend npm run seed:dev

# Or seed only the administrator account:
docker compose exec backend npm run seed:admin
```

#### Default Credentials:
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@gmail.com` | `admin@123` |
| **Organiser** | `organiser@gmail.com` | `organiser@123` |
| **User** | `user@gmail.com` | `user@123` |

---

### 14. Step-by-Step Project Feature Demonstration

Follow this sequence for the Project Lab examination:

1. **Authentication & RBAC**:
   - Open <http://localhost:5173/login>.
   - Log in as `admin@gmail.com` → Observe Admin navigation and system statistics.
   - Log out. Log in as `user@gmail.com` → Observe Participant view. Attempting to navigate to `/admin` is blocked.
2. **Event Creation & Pre-Event Planning**:
   - Log in as `organiser@gmail.com`.
   - Create a new event (e.g., *National AI Hackathon*). Status starts as `DRAFT`.
   - Open Event Planning:
     - Add **Tasks** (e.g., *Book Keynote Speaker*).
     - Add **Resources** (e.g., *Projectors, Badges*).
     - Add **Budget** items (e.g., *Catering, Venue Deposit*).
     - Assign **Team Members**.
   - Observe **Readiness Score** calculation in the planning dashboard.
3. **AI Planning Assistance**:
   - In the event planning view, click **AI Plan Analysis**.
   - The backend requests analysis from the FastAPI container (`/analyze`), returning heuristic risk findings and recommendations.
4. **Publishing & Registration**:
   - Transition event status to `UPCOMING`.
   - Log out and log in as `user@gmail.com`.
   - Browse events on the home page, select the event, and click **Register**.
   - Open **My Registrations** and view the generated **QR Code Attendance Credential**.
5. **QR Attendance Check-In**:
   - Log in as `organiser@gmail.com`.
   - Open the event's Attendance view and launch the **QR Scanner** (or enter the credential code manually).
   - Confirm check-in: participant status flips to `PRESENT`.
   - Attempt checking in the same credential again: observe **Duplicate Check-In Protection** (409 Conflict).
6. **Event Lifecycle & Feedback Analysis**:
   - Change event status to `COMPLETED`.
   - Log in as `user@gmail.com`.
   - Open feedback form and submit review: *"Outstanding event! The workshops were practical and very engaging."*
   - Observe that the feedback is classified with **VADER Sentiment Analysis** as `POSITIVE` with confidence metrics.
7. **Certificate Generation & Verification**:
   - Log in as `organiser@gmail.com`.
   - Navigate to **Certificates** and click **Generate Certificates**.
   - Log in as `user@gmail.com`, view **My Certificates**, and download the generated PDF certificate.
   - Copy the verification code (e.g., `HE02-YWWK-28FB-VD3M`) and open public verification (`/api/certificates/verify/<CODE>`).
8. **Post-Event Analytics, PDF Report & Future Improvements**:
   - Log in as `organiser@gmail.com` (or Admin).
   - View **Event Analytics**: Attendance Rate, Feedback Ratings, Sentiment Breakdown, Certificate Issuance Rate.
   - Click **Download Event Report** to generate and download the comprehensive PDF summary.
   - Click **Generate AI Improvements** to view rule-based recommendations for future events.

---

### 15. Troubleshooting Common Failures

- **Port already in use (`5173` or `5000` or `27017`)**:
  Check what process is using the port:
  ```powershell
  # Windows:
  netstat -ano | findstr :5000
  netstat -ano | findstr :5173
  ```
  Terminate the existing process or adjust `PORT` or frontend port mapping in `docker-compose.yml`.
- **Docker Desktop "Engine not running" on Windows**:
  Ensure WSL 2 is installed (`wsl --install`) and virtualization (VT-x / AMD-V) is enabled in computer BIOS.
- **Backend cannot connect to MongoDB**:
  Check MongoDB container logs:
  ```bash
  docker compose logs mongodb
  ```
  Verify that `MONGODB_URI` in `.env` uses `mongodb://mongodb:27017/event_management_system` (internal service name), not `localhost`.
- **Authentication cookie not saving in browser**:
  Ensure `COOKIE_SECURE=false` in `.env` when accessing over plain HTTP (`http://localhost:5173`). Modern browsers reject cookies with `Secure: true` over unencrypted HTTP.
- **Page refresh returns 404 in frontend**:
  The included Nginx configuration handles SPA routing via `try_files $uri $uri/ /index.html;`. If using a custom server, ensure all unmatched routes route to `index.html`.

---

### 16. Preparation for Central AI Project Lab Server

In Phase 2 of project deployment, the AI service may be hosted on a dedicated central lab machine rather than running locally on every student PC.

To configure EventFlow for a central AI service:
1. In the central machine, run only the AI container or Uvicorn listening on `0.0.0.0:8000`:
   ```bash
   docker compose up ai-service -d
   ```
2. Note the IP address of the central machine (e.g., `192.168.1.100`).
3. In the client computer's root `.env` file, update:
   ```ini
   AI_SERVICE_URL=http://192.168.1.100:8000
   ```
4. Restart the backend container:
   ```bash
   docker compose restart backend
   ```
5. All AI planning, sentiment analysis, and improvement calls from the backend will now route to the central server seamlessly.

---

## License

This project is developed for academic and educational purposes.