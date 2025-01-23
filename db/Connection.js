const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'steptosale',
    port: 8889,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});


// Export the promise-based pool
const db = pool.promise();

module.exports = db;
