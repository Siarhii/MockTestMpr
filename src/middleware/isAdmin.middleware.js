const db = require('../config/db.config');

const isAdmin = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const [user] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

        if (!user.length || user[0].role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        next();
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).json({ error: 'Server error while checking role.' });
    }
};

module.exports = isAdmin;
