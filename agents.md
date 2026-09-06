# TECD Agent Context

## Session Tracking
- Create a session log file in agents/memory/sessions/YYYY-MM-DD_HH-MM-SS.md
- Create a progress log file in agents/memory/progress.md
- Create a blockers log file in agents/memory/blockers.md
- Create a lessons learned log file in agents/memory/lessons.md
- Create a decisions log file in agents/memory/decisions.md
- Create an implementation log file in agents/memory/implementation.md

## Session Start Protocol
- Read agents/memory/progress.md - current state
- Read agents/memory/lessons.md - past mistakes
- Check agents/memory/blockers.md - current issues
- Ask: "Ready to continue with [current task]?"

## Development strategy
- Stay strictly with TDD: first write tests, run the tests and then the code
- Use red/green TDD
- The coverage tests must be at least 85%
- Before ending a task run unit and end to end tests. If anything fails, fix the code not the tests.
- Keep file code short (max 1000 lines) and split the code into components/classes
- Try to re-use code as much as possible

## Technology Stack

### Core
- **Frontend**: React (Vite), JavaScript (ES6+), TailwindCSS
- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`sqlite3` driver)
- **Environment**: Node.js 20.x (LTS)

### Key Libraries
- **Authentication**: `jsonwebtoken` (JWT), `bcryptjs`
- **File Handling**: `multer` (uploads), `adm-zip` (EPUB parsing)
- **UI Components**: `lucide-react` (icons), `shadcn/ui` (inspired structure)
- **API**: Axios (frontend), Swagger/OpenAPI (backend docs)
- **Avatars**: [DiceBear API](https://www.dicebear.com) (User avatars)

### Security Policy
- **Dependencies**: The project MUST use only libraries that do not have **High** or **Critical** vulnerabilities.
- **Auditing**: Run `npm audit` regularly and update/replace vulnerable packages immediately.


## Database Management

### Schema & Migrations
- **Primary Schema Definition**: The complete database schema is maintained in `backend/migrations/001_initial.sql`. If a database already exists, please use the schema of the existing database and create the first migration script based on the available schema.
- **Migration Strategy**: 
  - We use a "squashed" migration approach where the initial state is defined in `001_initial.sql`. 
  - New migrations can be added as `002_...`, `003_...`, etc., but periodically they may be consolidated back into `001_initial.sql` to keep the project clean.
  - All table definitions in migrations MUST use `IF NOT EXISTS` to ensure idempotency.

### Initialization & Seeding
- **Automatic Startup**: The backend automatically initializes the database on startup:
  1. **Structure**: `run_migrations` applies all SQL files in `backend/migrations/`.
  2. **Roles**: `seed_userroles` populates `UserRoles` ONLY if the table is empty.
  3. **Users**: `seed_users` creates default users (`admin`, `reader1`, `guest1`) ONLY if the `Users` table is empty.

### Development vs Production
- **Server Deployment**:
  - The `backend/data` directory must exist and be writable by the process user.
  - `DEPLOYMENT.md` contains the authoritative guide for server setup.

## Testing Strategy

### Mandatory
- **Unit Tests**:
  - Required for **every new file** (utils, services, etc.) and **new feature**.
  - Must mock external dependencies (DB, File System).
- **Integration Tests**:
  - Required for **API endpoints** using `supertest`.
  - Must verify the flow from Route -> Controller -> Database (using in-memory or test DB).
  - Essential for critical user flows (auth, booking logic, library scanning).
- **Regression Tests**: if not exist, create a QA_TEST_PLAN.md with scenario to be tested as a QA engineer. This file needs to be updated everytime a new feature is added to the application.
- **Tooling**: Jest (Runner/Assertions) and Supertest (HTTP assertions).
- **PR instructions**:
	- Title format: project name, title
	- Always run `pnpm lint` and `pnpm test` before committing.

## Secure Session & Authentication Best Practices

### Session Management
- **HttpOnly Cookies**: ALWAYS use `HttpOnly` cookies for storing session tokens (JWT). Never return tokens in the response body or store them in `localStorage/sessionStorage` to prevent XSS attacks.
- **Secure Configuration**: Set cookie attributes: `HttpOnly; Path=/; SameSite=Lax` (or `Strict`). Use `Secure` in production (HTTPS).
- **Expiration**: Set appropriate `Max-Age` for cookies (e.g., 2 hours).

### Authentication & Authorization
- **Server-Side Validation**: User roles and permissions MUST be validated on the backend for every protected route. Do not rely on client-side state for authorization.
- **Client-Side State**: The frontend should fetch user status (e.g., `/api/me`) to determine UI state, but this is for display purposes only. 
- **Credentials**: Configure API clients with `withCredentials: true` or `credentials: 'include'` to ensure cookies are sent with requests.
- **CORS**: Configure backend CORS to strictly allow specific origins and `credentials: true`. Wildcard `*` is NOT allowed with credentials.

### Asset Protection
- **Protected Resources**: Serve static assets (like files) through authenticated routes (e.g., streaming endpoints) rather than public static folders if they require permission.
- **Cross-Origin**: When fetching resources that require cookies (like images served via authenticated endpoints), use `crossorigin="use-credentials"` on HTML elements.