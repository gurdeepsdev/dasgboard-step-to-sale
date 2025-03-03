const bcrypt = require('bcrypt');
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

// Admin credentials
const email = 'superadmin@example.com';
const password = 'Super@123';
const role = 'superadmin';
const permissions = JSON.stringify(["manage_admins", "manage_users", "manage_coupons"]);

bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }

    const sql = `INSERT INTO admins (email, password, role, permissions) VALUES (?, ?, ?, ?)`;
    db.query(sql, [email, hashedPassword, role, permissions], (error, result) => {
        if (error) {
            console.error('Error inserting super admin:', error);
        } else {
            console.log('Super admin created successfully!');
        }
        db.end();
    });
});
