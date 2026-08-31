# 📞 Satmer - IVR Phone System for Chesed Activities

A comprehensive Interactive Voice Response (IVR) system for managing weekly chesed (charity) activities and tracking personal achievements for Satmer girls' seminary.

## ✨ Features

### 🎯 Three Main Extensions

**Extension 1: Weekly Activity Update**
- Users call to confirm participation in weekly chesed activities
- Updates reset weekly after Shabbat
- One update per week limit
- Earn 10 points per week

**Extension 2: Completion Tracker**
- Record personal spiritual completions/achievements
- Monthly update limit
- Track cumulative completions throughout the year
- Earn 20 points per completion

**Extension 3: Summary & Achievements**
- Listen to personal statistics
- View total points earned
- Track participation rate
- View completion count

### 🛠️ Admin Features

- User management (add/remove users)
- Activity logs and monitoring
- Generate reports (weekly/monthly/yearly)
- System statistics
- Annual data reset
- Notification management

### 📊 Reporting

- **Weekly Reports**: Export CSV of weekly activities
- **Monthly Reports**: Export CSV of monthly completions
- **Yearly Reports**: Comprehensive summary of all users' achievements
- Points calculation and awards eligibility

### 🔔 Notifications

- Weekly reminder SMS/Telegram notifications
- Configurable notification time per user
- Achievement notifications
- Admin broadcast messages

### 🔐 Security

- ID number based authentication
- JWT token system
- Role-based access control (user/admin)
- Call logging and audit trail

## 🚀 Setup & Installation

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- Technoline API account (for IVR integration)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd satmer

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure environment variables
# Edit .env with your settings:
# - Database credentials
# - JWT secret
# - Technoline API key
# - Telegram bot token (optional)
```

### Database Setup

```bash
# Create database
createdb satmer_db

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### Start Server

```bash
# Development
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with ID number
- `GET /api/auth/verify` - Verify JWT token

### IVR System
- `POST /api/ivr/extension-1/status` - Update weekly activity
- `GET /api/ivr/extension-1/status` - Get activity status
- `POST /api/ivr/extension-2/status` - Record completion
- `GET /api/ivr/extension-2/status` - Get completion status
- `GET /api/ivr/extension-3/summary` - Get personal summary

### User Profile
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/notification-preferences` - Set notification preferences
- `GET /api/users/notification-preferences` - Get notification settings

### Activities
- `GET /api/activities` - List user's activities
- `GET /api/activities/current-week` - Get current week's activity
- `GET /api/activities/statistics` - Get activity statistics

### Completions
- `GET /api/completions` - List completions
- `GET /api/completions/:number` - Get specific completion
- `GET /api/completions/statistics/summary` - Get completion statistics

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:userId/activate` - Activate user
- `PUT /api/admin/users/:userId/deactivate` - Deactivate user
- `GET /api/admin/activity-logs` - View activity logs
- `POST /api/admin/reset-yearly-data` - Reset annual data
- `GET /api/admin/statistics` - System statistics

### Reports
- `GET /api/reports/weekly?week=X&year=YYYY` - Download weekly report CSV
- `GET /api/reports/monthly?month=X&year=YYYY` - Download monthly report CSV
- `GET /api/reports/yearly?year=YYYY` - Download yearly report CSV

## 📊 Data Models

### User
- ID, Name, Israeli ID Number
- Phone, Email
- Role (user/admin)
- Notification preferences (day, hour)
- Active status

### Activity (Weekly)
- Week number and date
- Parsha name
- Participation status
- Points earned
- Recording URL

### Completion (Monthly/Yearly)
- Completion number (sequential)
- Month and year
- Points earned
- Recording URL

### UserNotification
- Type (reminder, achievement, etc.)
- Title and message
- Read/unread status

### ActivityLog
- Action performed
- Extension used
- Status
- Call duration
- IP address

## 🔄 Scheduled Jobs

- **Weekly Reset**: Every Sunday at midnight
- **Monthly Reset**: 1st of each month
- **Yearly Reset**: 1st of Sivan (Hebrew calendar) - June 1st
- **Weekly Notifications**: Sent at configured user times
- **Activity Logs Cleanup**: Archive old logs (configurable)

## 🌐 Integration with Technoline

The system integrates with Technoline IPSales PBX for:
- Incoming call handling
- IVR extension setup
- Voice message playback
- Call recording
- SMS notifications

Configure Technoline API credentials in `.env`:
```env
TECHNOLINE_API_KEY=your_api_key
TECHNOLINE_API_URL=https://api.ipsales.co.il/api
TECHNOLINE_PBX_ID=your_pbx_id
APP_URL=https://your-domain.com
```

## 📝 Usage Examples

### User Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"idNumber":"123456789"}'
```

### Update Weekly Activity
```bash
curl -X POST http://localhost:3000/api/ivr/extension-1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participated": true}'
```

### Get User Summary
```bash
curl -X GET http://localhost:3000/api/ivr/extension-3/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎁 Points System

- **Weekly Activity**: 10 points per week
- **Completion**: 20 points per completion
- **Achievement Milestones**: Bonus points (configurable)
- **Annual Prize**: Top performers based on total points

## 📅 Hebrew Calendar Integration

- Annual reset on 1st of Sivan (Hebrew calendar)
- Parsha names integrated with Torah portions
- Hebrew language support throughout

## 🔒 Security Notes

- All communications use JWT authentication
- ID numbers validated using Israeli checksum algorithm
- All calls logged for audit trail
- Sensitive data encrypted in transit
- Admin panel access restricted to admin role

## 🛠️ Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests (when available)
npm test

# Linting (when configured)
npm run lint
```

## 📞 Support & Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DB_* environment variables
   - Ensure PostgreSQL is running
   - Verify database exists

2. **Technoline API Errors**
   - Verify API key is correct
   - Check API URL is accessible
   - Review Technoline documentation

3. **Authentication Failures**
   - Ensure JWT_SECRET is set
   - Check token expiration
   - Verify ID number format

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributors

- Satmer Seminary Development Team

---

**Last Updated**: August 2026
**Version**: 1.0.0
