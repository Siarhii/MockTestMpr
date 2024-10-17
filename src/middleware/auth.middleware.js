const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const token = req.cookies.authToken;
    if (!token) {
        return res.redirect('/loginpage');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
}

module.exports = authenticateToken;
