# 🚀 SETUP & DEPLOYMENT GUIDE

## Complete Setup Instructions for Attendance Management System

---

## 📋 PREREQUISITES

- **Node.js**: v16.x or higher
- **npm**: v7.x or higher  
- **MongoDB Atlas Account**: Free tier available
- **Browser**: Modern browser with Geolocation API support
- **Internet**: For MongoDB Atlas connectivity

---

## 1️⃣ MONGODB ATLAS SETUP

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free"
3. Create account with email
4. Verify email address

### Step 2: Create a Cluster
1. Click "Create a Deployment"
2. Choose "M0 Sandbox" (Free tier)
3. Select region close to you
4. Click "Create Deployment"
5. Wait 2-3 minutes for cluster creation

### Step 3: Create Database User
1. Go to "Database Access"
2. Click "Add New Database User"
3. Choose "Password"
4. Username: `attendance_user`
5. Password: Generate secure password (save it!)
6. Database User Privileges: "Built-in Role: Read and write to any database"
7. Click "Add User"

### Step 4: Whitelist IP Address
1. Go to "Network Access"
2. Click "Add IP Address"
3. Select "Allow Access from Anywhere" (for development)
   - OR: Add your specific IP
4. Click "Confirm"

### Step 5: Get Connection String
1. Click "Databases"
2. Click "Connect" button on your cluster
3. Choose "Drivers"
4. Select "Node.js" version 5.x or higher
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Add database name: `attendance_system`

Final URL format:
```
mongodb+srv://attendance_user:your_password@cluster-name.mongodb.net/attendance_system?retryWrites=true&w=majority
```

---

## 2️⃣ LOCAL INSTALLATION

### Step 1: Navigate to Project
```bash
cd c:\PROJECT-FAKE\ DL\attendance-sys
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs:
- express (web server)
- mongoose (MongoDB driver)
- cors (cross-origin support)
- qrcode (QR code generation)
- dotenv (environment variables)

### Step 3: Configure Environment
Edit `.env` file:
```env
PORT=3001
NODE_ENV=development
SESSION_SECRET=your-secret-key-change-in-production

# Add MongoDB connection string
MONGODB_URI=mongodb+srv://attendance_user:password@cluster.mongodb.net/attendance_system?retryWrites=true&w=majority

# Frontend URL (for QR codes)
FRONTEND_URL=http://localhost:3001
```

Replace `attendance_user` and `password` with your credentials from Step 3.

### Step 4: Start Server
```bash
npm start
```

You should see:
```
✅ MongoDB Connected Successfully
   Database: attendance_system

🚀 Attendance System running at http://localhost:3001

📋 Endpoints:
   🏠 Home: http://localhost:3001
   👔 Organizer Panel: http://localhost:3001/organizer
   📋 Forms API: http://localhost:3001/api/forms
   ✅ Attendance API: http://localhost:3001/api/attendance
```

---

## 3️⃣ VERIFY INSTALLATION

### Test 1: Health Check
Open browser and go to:
```
http://localhost:3001/api/health
```

Expected response:
```json
{ "status": "OK" }
```

### Test 2: Access Organizer Panel
```
http://localhost:3001/organizer
```

Should display form builder interface.

### Test 3: Test Form Creation
1. Go to organizer panel
2. Click "Create New Form"
3. Fill form:
   - Event Name: "Test Event"
   - Date: Today's date
   - Location Latitude: 28.5244
   - Location Longitude: 77.1855
4. Click "Create Form"
5. Copy form link

### Test 4: Test Student Form
1. Paste form link in new browser tab
2. Allow location access when prompted
3. Fill form fields
4. Click "Submit"
5. Should see success message

---

## 4️⃣ TROUBLESHOOTING

### Issue: "Cannot find module 'mongoose'"
**Solution:**
```bash
npm install mongoose
```

### Issue: "MongoDB Connection Error"
**Solutions:**
1. Check internet connection
2. Verify MongoDB URI in .env
3. Check MongoDB Atlas cluster is active
4. Verify database user credentials
5. Check IP whitelist in MongoDB Atlas

### Issue: "Location not capturing"
**Solutions:**
1. Check browser allows geolocation
2. Ensure HTTPS (for production)
3. Try different browser
4. Check device has GPS/internet

### Issue: "FormId not matching"
**Solution:**
QR codes may take time to generate. Refresh page if QR doesn't show.

### Issue: "Port 3001 already in use"
**Solutions:**
Change PORT in .env:
```
PORT=3002
```

Or kill process using port:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID pid_number /F

# Mac/Linux
lsof -i :3001
kill -9 pid_number
```

---

## 5️⃣ FILE STRUCTURE VERIFICATION

Ensure all files are in place:

```
attendance-sys/
├── ✅ server.js
├── ✅ .env
├── ✅ package.json
├── ✅ attendanceSystemClient.js
├── ✅ README.md
├── ✅ API_INTEGRATION_GUIDE.md
├── database/
│   ├── ✅ connection.js
│   └── ✅ setup.js
├── models/
│   ├── ✅ formModel.js
│   └── ✅ attendanceModel.js
├── controllers/
│   ├── ✅ formController.js
│   └── ✅ attendanceController.js
├── routes/
│   ├── ✅ formRoutes.js
│   └── ✅ attendanceRoutes.js
└── frontend/
    ├── ✅ index.html
    ├── ✅ organizer.html
    ├── ✅ student-form.html
    ├── css/
    │   └── ✅ styles.css
    └── js/
        ├── ✅ organizer.js
        └── ✅ student-form.js
```

---

## 6️⃣ PRODUCTION DEPLOYMENT

### Option 1: Heroku

#### Step 1: Create Heroku Account
https://www.heroku.com/signup

#### Step 2: Install Heroku CLI
https://devcenter.heroku.com/articles/heroku-cli

#### Step 3: Deploy
```bash
# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option 2: AWS EC2

#### Step 1: Launch Instance
1. Go to AWS Console
2. Create EC2 instance (t2.micro free tier)
3. Use Ubuntu 20.04 LTS
4. Configure security groups (allow ports 80, 443, 3001)

#### Step 2: Connect & Install
```bash
# SSH into instance
ssh -i key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Clone repository
git clone your-repo
cd attendance-sys

# Install dependencies
npm install

# Set environment variables
nano .env  # Add your config

# Start with PM2
sudo npm install -g pm2
pm2 start server.js --name "attendance-sys"
pm2 save
pm2 startup
```

#### Step 3: Setup Nginx (Reverse Proxy)
```bash
sudo apt install nginx

# Edit config
sudo nano /etc/nginx/sites-available/default

# Add:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 4: Setup SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 3: Docker

Create `Dockerfile`:
```dockerfile
FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Create `.dockerignore`:
```
node_modules
.env
.git
```

Build and run:
```bash
docker build -t attendance-sys .
docker run -p 3001:3001 --env-file .env attendance-sys
```

---

## 7️⃣ MONITORING & MAINTENANCE

### View Server Logs
```bash
# Development
npm start

# Production (with PM2)
pm2 logs attendance-sys
pm2 log
```

### Database Maintenance
1. Go to MongoDB Atlas Dashboard
2. Check cluster metrics
3. Monitor storage usage
4. Review backup settings

### Regular Backups
MongoDB Atlas provides automatic backups.
To enable:
1. Go to Backup page
2. Enable "Continuous Backups"
3. Set retention period (30 days recommended)

---

## 8️⃣ PERFORMANCE OPTIMIZATION

### Frontend Optimization
```bash
# Minify CSS
npm install -g csso-cli
csso frontend/css/styles.css -o frontend/css/styles.min.css
```

### Database Optimization
1. Enable compression in MongoDB
2. Use indexes wisely
3. Archive old data weekly

### Server Optimization
1. Enable GZIP compression
2. Use caching headers
3. Scale horizontally (load balancer)

---

## 9️⃣ INTEGRATION WITH FAKE DL SYSTEM

### Quick Integration
```javascript
// In your DL system
const AttendanceClient = require('./attendanceSystemClient');
const client = new AttendanceClient('http://localhost:3001');

async function checkAttendance(uid, eventId) {
  const attendance = await client.verifyAttendance(uid, eventId);
  return attendance?.isValid ?? false;
}
```

See `API_INTEGRATION_GUIDE.md` for detailed examples.

---

## 🔟 LAUNCHING CHECKLIST

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with strong password
- [ ] IP whitelist configured
- [ ] Connection string in `.env`
- [ ] NPM dependencies installed
- [ ] Server starts without errors
- [ ] Health check endpoint responds
- [ ] Organizer panel loads
- [ ] Form creation works
- [ ] Student form submission works
- [ ] Attendance data appears in MongoDB

---

## 📞 SUPPORT

### Common Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Check Node version
node -v

# Check npm version
npm -v

# List running Node processes
ps aux | grep node

# Kill process
kill -9 process_id
```

### Log Files
- Production logs: `/var/log/pm2/`
- Development console: Terminal running `npm start`
- MongoDB logs: MongoDB Atlas Dashboard

### Useful Links
- MongoDB Atlas: https://cloud.mongodb.com
- Node.js Docs: https://nodejs.org/docs
- Express Docs: https://expressjs.com
- Heroku Docs: https://devcenter.heroku.com

---

## 🎯 NEXT STEPS

1. ✅ Complete MongoDB setup
2. ✅ Install dependencies locally
3. ✅ Test form creation
4. ✅ Test student form
5. ✅ Integrate with Fake DL system
6. ✅ Deploy to production
7. ✅ Setup monitoring
8. ✅ Configure backups

---

**Last Updated**: March 31, 2026  
**Status**: Complete & Ready for Production
