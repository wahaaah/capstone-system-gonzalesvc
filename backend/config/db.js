const mysql = require('mysql2/promise');

require('dotenv').config();

const required = [
    'MYSQLHOST',
    'MYSQLPORT',
    'MYSQLUSER',
    'MYSQLPASSWORD',
    'MYSQL_DATABASE'
];

for (const name of required) {
    if (!process.env[name]) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
}

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    port: Number(process.env.MYSQLPORT || 3306),
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQL_DATABASE,

    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 10000
});

module.exports = pool;