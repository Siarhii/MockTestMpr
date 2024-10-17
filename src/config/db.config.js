const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: "stardust$69",
    database: "mock_test_platform",
});

const db = pool.promise();

module.exports = db;
