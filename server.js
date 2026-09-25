const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("payflow.db");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   DATABASE
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    balance REAL DEFAULT 10000
);

CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    description TEXT,
    amount REAL,
    status TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS bills(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    consumer TEXT,
    amount REAL,
    status TEXT,
    created_at TEXT
);
`);

/* =========================
   DEMO USER
========================= */

let user = db
    .prepare("SELECT * FROM users LIMIT 1")
    .get();

if (!user) {
    db.prepare(
        "INSERT INTO users(name,mobile,balance) VALUES(?,?,?)"
    ).run(
        "Aishwarya Natikar",
        "9999999999",
        10000
    );

    user = db
        .prepare("SELECT * FROM users LIMIT 1")
        .get();
}

/* =========================
   API - USER
========================= */

app.get("/api/me", (req, res) => {
    user = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(user.id);

    res.json(user);
});

/* =========================
   API - TRANSACTIONS
========================= */

app.get("/api/transactions", (req, res) => {

    const transactions = db
        .prepare(`
            SELECT *
            FROM transactions
            WHERE user_id=?
            ORDER BY id DESC
            LIMIT 50
        `)
        .all(user.id);

    res.json(transactions);
});

/* =========================
   SEND MONEY
========================= */

app.post("/api/send", (req, res) => {

    const { recipient, amount } = req.body;
    const n = Number(amount);

    if (
        !recipient ||
        !Number.isFinite(n) ||
        n <= 0
    ) {
        return res.status(400).json({
            error: "Enter a valid recipient and amount"
        });
    }

    const u = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(user.id);

    if (n > u.balance) {
        return res.status(400).json({
            error: "Insufficient demo balance"
        });
    }

    db.prepare(
        "UPDATE users SET balance=balance-? WHERE id=?"
    ).run(n, user.id);

    db.prepare(`
        INSERT INTO transactions
        (user_id,type,description,amount,status,created_at)
        VALUES(?,?,?,?,?,datetime('now'))
    `).run(
        user.id,
        "DEBIT",
        "Paid to " + recipient,
        n,
        "SUCCESS"
    );

    res.json({
        ok: true,
        message: `₹${n.toFixed(2)} sent successfully`
    });
});

/* =========================
   ADD MONEY
========================= */

app.post("/api/add-money", (req, res) => {

    const n = Number(req.body.amount);

    if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({
            error: "Invalid amount"
        });
    }

    db.prepare(
        "UPDATE users SET balance=balance+? WHERE id=?"
    ).run(n, user.id);

    db.prepare(`
        INSERT INTO transactions
        (user_id,type,description,amount,status,created_at)
        VALUES(?,?,?,?,?,datetime('now'))
    `).run(
        user.id,
        "CREDIT",
        "Demo wallet top-up",
        n,
        "SUCCESS"
    );

    res.json({
        ok: true,
        message: `₹${n.toFixed(2)} added successfully`
    });
});

/* =========================
   BILL PAYMENT
========================= */

app.post("/api/bill", (req, res) => {

    const {
        category,
        consumer,
        amount
    } = req.body;

    const n = Number(amount);

    if (
        !category ||
        !consumer ||
        !Number.isFinite(n) ||
        n <= 0
    ) {
        return res.status(400).json({
            error: "Complete all bill details"
        });
    }

    const u = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(user.id);

    if (n > u.balance) {
        return res.status(400).json({
            error: "Insufficient demo balance"
        });
    }

    db.prepare(
        "UPDATE users SET balance=balance-? WHERE id=?"
    ).run(n, user.id);

    db.prepare(`
        INSERT INTO bills
        (user_id,category,consumer,amount,status,created_at)
        VALUES(?,?,?,?,?,datetime('now'))
    `).run(
        user.id,
        category,
        consumer,
        n,
        "PAID"
    );

    db.prepare(`
        INSERT INTO transactions
        (user_id,type,description,amount,status,created_at)
        VALUES(?,?,?,?,?,datetime('now'))
    `).run(
        user.id,
        "DEBIT",
        category + " bill",
        n,
        "SUCCESS"
    );

    res.json({
        ok: true,
        message: "Bill paid successfully"
    });
});

/* =========================
   MOBILE RECHARGE
========================= */

app.post("/api/recharge", (req, res) => {

    const {
        mobile,
        amount
    } = req.body;

    const n = Number(amount);

    if (
        !mobile ||
        !Number.isFinite(n) ||
        n <= 0
    ) {
        return res.status(400).json({
            error: "Enter valid recharge details"
        });
    }

    const u = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(user.id);

    if (n > u.balance) {
        return res.status(400).json({
            error: "Insufficient demo balance"
        });
    }

    db.prepare(
        "UPDATE users SET balance=balance-? WHERE id=?"
    ).run(n, user.id);

    db.prepare(`
        INSERT INTO transactions
        (user_id,type,description,amount,status,created_at)
        VALUES(?,?,?,?,?,datetime('now'))
    `).run(
        user.id,
        "DEBIT",
        "Mobile recharge " + mobile,
        n,
        "SUCCESS"
    );

    res.json({
        ok: true,
        message: "Recharge completed successfully"
    });
});

/* =========================
   FRONTEND FALLBACK
   Express 5 compatible
========================= */

app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `PayFlow running on http://localhost:${PORT}`
    );
});