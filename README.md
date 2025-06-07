# HRMS (Human Resource Management System)

A full-stack HRMS solution for managing procurement, requisitions, RFQs, purchase orders, invoices, vendors, and more.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running the Backend](#running-the-backend)
  - [Running the Frontend](#running-the-frontend)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Project Structure

```
hrms/           # Backend (Node.js/Express/MongoDB)
hrms-client/    # Frontend (React.js)
```

---

## Features

- User authentication and authorization (JWT)
- Employee requisition management
- Vendor registration and management
- Request for Quotation (RFQ) workflow
- Purchase order management
- Invoice processing and payment tracking
- Role-based dashboards (Admin, Employee, Vendor)
- Notification system
- PDF export for requisitions and invoices

---

## Tech Stack

- **Backend:** Node.js, Express, MongoDB, Mongoose
- **Frontend:** React.js, Tailwind CSS, Material UI, Framer Motion
- **Authentication:** JWT
- **Other:** Docker, Caddy, Nginx

---

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- MongoDB
- Docker (optional, for containerized deployment)

### Environment Variables

#### Backend (`hrms/.env`)

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
...
```

#### Frontend (`hrms-client/.env`)

```
REACT_APP_BACKEND_URL=http://localhost:4000
...
```

### Installation

#### 1. Clone the repository

```sh
git clone <your-repo-url>
cd hrms
```

#### 2. Install backend dependencies

```sh
cd hrms
npm install
```

#### 3. Install frontend dependencies

```sh
cd ../hrms-client
npm install
```

---

### Running the Backend

```sh
cd hrms
npm start
```
The backend will run on `http://localhost:4000` by default.

### Running the Frontend

```sh
cd hrms-client
npm start
```
The frontend will run on `http://localhost:3000` by default.

---

## Scripts

### Backend

- `npm start` - Start the backend server
- `npm run dev` - Start backend with nodemon (development)

### Frontend

- `npm start` - Start the React development server
- `npm run build` - Build the frontend for production
- `npm test` - Run frontend tests

---

## Deployment

You can deploy using Docker Compose:

```sh
docker-compose up --build
```

Or deploy frontend and backend separately to your preferred cloud provider.

---

## Folder Structure

### Backend (`hrms/`)

- `api/controllers/` - Express controllers
- `api/services/` - Business logic/services
- `models/` - Mongoose models
- `routes/` - Express routes
- `uploads/` - File uploads (e.g., avatars)
- `server.js` - Entry point

### Frontend (`hrms-client/`)

- `src/pages/` - React pages (dashboard, requisitions, vendors, etc.)
- `src/authcontext/` - Authentication context
- `src/App.js` - Main app component
- `public/` - Static assets

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Create a new Pull Request

---

## License

This project is licensed under the MIT License.

---

## Contact

For questions or support, please open an issue or contact the maintainer.
