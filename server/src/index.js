const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
let express = require('express')
let app = express()
let cors = require('cors')
let db = require('./models/db')
const skillRoutes = require('./controllers/skills');
const userRoutes = require('./controllers/user');
const resourceRoutes = require('./controllers/resource');
const swapsRoutes = require('./controllers/skillswap');
const reviewsRoutes = require('./controllers/reviews');
const authRoutes = require('./controllers/auth');
const adminRoutes = require('./controllers/admin');
const verificationsRoutes = require('./controllers/verifications');
const paymentRoutes = require('./controllers/payment');
const earningsRoutes = require('./controllers/earnings');
const classRoutes = require('./controllers/classes');
const reportsRoutes = require('./controllers/reports');
const Review = require('./models/Review');
// let Users = require('./models/User')



// database connection
db()

// Ensure all upload directories exist
const uploadsBaseDir = path.resolve(__dirname, '../assets/uploads');
['avatars', 'certificates', 'classes', 'attachments', 'verifications'].forEach(sub => {
    const dir = path.join(uploadsBaseDir, sub);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// middlewares
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: false }))
app.use(cors({
    origin: true, credentials: true
}))
app.use(express.static('./assets'))
app.use(express.static(path.join(__dirname, '../assets')))
app.use('/uploads', express.static(path.join(__dirname, '../assets/uploads')))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use('/uploads', express.static(path.join(__dirname, './uploads')))







// routes
app.get('/', (req, res) => {
    res.json({ message: "Backend Working" })
})

app.post('/debug-log', (req, res) => {
    console.log('[CLIENT DEBUG]', req.body);
    res.json({ ok: true });
})

app.use('/skills', skillRoutes);
app.use('/api/skills', skillRoutes);
app.use('/users', userRoutes);
app.use('/resources', resourceRoutes);
app.use('/swaps', swapsRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/users', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/verifications', verificationsRoutes);
app.use('/api/verifications', verificationsRoutes);
app.use('/payments', paymentRoutes);
app.use('/earnings', earningsRoutes);
app.use('/classes', classRoutes);
app.use('/api/classes', classRoutes);
app.use('/reports', reportsRoutes);

// app.get('/data', async (req, res) => {
//     await Review.updateMany({}, {
//         moderationStatus: 'pending',
//     })

//     res.json({ updated: true })
// })



const http = require('http');
const { initSocket } = require('./socket');

const server = http.createServer(app);
initSocket(server);

// listening
server.listen(3201, "0.0.0.0", () => {
    console.log("[Socket.IO] Express & Socket.IO server running on http://localhost:3201");
});