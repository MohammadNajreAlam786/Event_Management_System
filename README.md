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
├── frontend/             # React + Vite client (Nginx in Docker)
├── backend/              # Node.js + Express API server
├── ai-service/           # FastAPI Python sentiment & planning analysis
├── docker-compose.yml    # Production multi-service orchestration
├── docker-compose.dev.yml# Containerized development with hot-reload
├── .env.example          # Docker environment configuration template
└── README.md
```

## Quick Start with Docker (Recommended)

The entire system (MongoDB, AI Service, Express Backend, and React Frontend via Nginx) can be launched with a single command.

### 1. Configure Environment (Optional)

```bash
# Copy template to .env (defaults are pre-configured and ready to run)
cp .env.example .env
```

### 2. Build and Run

```bash
# Production stack (Nginx, Express, FastAPI, MongoDB)
docker compose up -d --build
```

### 3. Access Services

- **Frontend Application**: <http://localhost> (or <http://localhost:80>)
- **Backend API**: <http://localhost:5000/api>
- **Backend Health Check**: <http://localhost:5000/api/health>
- **AI Service Health Check**: <http://localhost:8000/health>
- **MongoDB**: `localhost:27017`

> Default test accounts are automatically seeded on first startup when `AUTO_SEED=true`.

### 4. Useful Docker Commands

```bash
# View live logs
docker compose logs -f

# Check container health status
docker compose ps

# Re-run database seed manually inside container
docker compose exec backend npm run seed:dev

# Stop all services
docker compose down

# Stop and wipe database volume for a clean state
docker compose down -v
```

### 5. Containerized Development with Hot Reloading

For local development inside containers with live code reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## Manual Installation and Setup (Without Docker)

### 1. Start MongoDB

Make sure MongoDB is running locally.

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

## License

This project is developed for academic and educational purposes.