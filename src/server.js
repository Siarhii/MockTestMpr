const express = require('express');
const app = express();
const path = require('path')
const logger = require('./errorHelper.js')
const cookieParser = require('cookie-parser');
const testRoutes = require('./routes/test.routes');
const authRoutes = require('./routes/auth.routes');
const authenticate = require('./middleware/auth.middleware');
const isAdmin = require('./middleware/isAdmin.middleware');


app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/tests', testRoutes);
app.use('/auth', authRoutes);


app.get('/adminpage', authenticate, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
})
app.get('/addtestpage', authenticate, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'addTests.html'));
})
app.get('/homepage', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainPage.html'));
})
app.get("/loginpage", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'loginPage.html'));
})

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});