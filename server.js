// ============================================
// FILE: server.js - WEB MONITOR DIXZZXD
// RUN: node server.js
// PORT: 3000 (default)
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database sederhana
let stats = {
    totalRequests: 0,
    uniqueIPs: new Set(),
    requestsPerSecond: 0,
    maxRps: 0,           // <-- PASTIKEN INI ADA
    history: [],
    startTime: Date.now()
};

// Hitung requests per detik
let lastSecond = Date.now();
let requestsThisSecond = 0;

// Ambil data RAM doang
function getServerStats() {
    return {
        ram: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1),
        totalRam: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
        freeRam: (os.freemem() / 1024 / 1024 / 1024).toFixed(1)
    };
}

setInterval(() => {
    const now = Date.now();
    if (now - lastSecond >= 1000) {
        stats.requestsPerSecond = requestsThisSecond;
        
        // UPDATE MAX RPS
        if (requestsThisSecond > stats.maxRps) {
            stats.maxRps = requestsThisSecond;
        }
        
        const serverStats = getServerStats();
        
        stats.history.push({
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            count: requestsThisSecond,
            ram: serverStats.ram
        });

        if (stats.history.length > 60) {
            stats.history.shift();
        }

        requestsThisSecond = 0;
        lastSecond = now;

        io.emit('stats', {
            total: stats.totalRequests,
            uniqueIPs: stats.uniqueIPs.size,
            rps: stats.requestsPerSecond,
            maxRps: stats.maxRps,           // <-- MAX RPS DIKIRIM
            history: stats.history,
            uptime: Math.floor((Date.now() - stats.startTime) / 1000),
            serverStats: serverStats
        });
    }
}, 100);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Endpoint buat load test
app.get('/attack', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    stats.totalRequests++;
    stats.uniqueIPs.add(clientIP);
    requestsThisSecond++;
    
    const serverStats = getServerStats();
    
    res.json({
        status: 'OK',
        timestamp: Date.now(),
        server: serverStats,
        yourIP: clientIP
    });
});

// Endpoint buat dashboard
app.get('/stats', (req, res) => {
    const serverStats = getServerStats();
    res.json({
        total: stats.totalRequests,
        uniqueIPs: stats.uniqueIPs.size,
        rps: stats.requestsPerSecond,
        maxRps: stats.maxRps,               // <-- MAX RPS DI RESPON
        uptime: Math.floor((Date.now() - stats.startTime) / 1000),
        serverStats: serverStats,
        history: stats.history
    });
});

// Reset stats
app.post('/reset', (req, res) => {
    stats = {
        totalRequests: 0,
        uniqueIPs: new Set(),
        requestsPerSecond: 0,
        maxRps: 0,                          // <-- RESET MAX RPS JUGA
        history: [],
        startTime: Date.now()
    };
    lastSecond = Date.now();
    requestsThisSecond = 0;
    res.json({ status: 'reset' });
});

// Endpoint buat dapetin IP client
app.get('/myip', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = clientIP.replace('::ffff:', '');
    res.json({ ip: cleanIP });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════╗
║    DIXZZXD - LOADTEST MONITOR       ║
║    http://localhost:${PORT}           ║
║                                      ║
║    🎯 TARGET: http://IP:${PORT}/attack║
║    👤 YOUR IP: http://IP:${PORT}/myip ║
╚══════════════════════════════════════╝
    `);
});