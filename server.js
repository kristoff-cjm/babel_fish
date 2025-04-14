const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

app.use(express.json());

const messagesFile = path.join(__dirname, "messages.json");

let clients = {};


wss.on('connection', (ws) => {
    let clientId = uuidv4();
    clients[clientId] = ws;

    ws.send(JSON.stringify({ type: "init", clientId }));

    console.log(`Client connected: ${clientId}`);

    ws.on('message', async (messageData) => {
        let message;
        try {
            message = JSON.parse(messageData);
        } catch (e) {
            console.error("Invalid message format:", e);
            return;
        }

        if (message.type === "message") {
            await handleIncomingMessage(clientId, message);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        delete clients[clientId];
    });
});

async function handleIncomingMessage(clientId, message) {
    const { text, sourceLang } = message;

    if (!text || !sourceLang) {
        console.error("Missing text or language in message:", message);
        return;
    }

    const targetLang = sourceLang === "en" ? "es" : "en";
    let translated;

    try {
        translated = await translateText(text, sourceLang, targetLang);
    } catch (e) {
        console.error("Translation failed:", e);
        return;
    }

    const newMessage = {
        en: sourceLang === "en" ? text : translated,
        es: sourceLang === "es" ? text : translated,
        datetime: new Date().toISOString(),
        clientId,
        language: sourceLang
    };

    // Read, append, and write to file
    fs.readFile(messagesFile, "utf8", (err, data) => {
        if (!err && data) {
            try {
                var messages = JSON.parse(data);
            } catch (e) {
                console.error("Corrupt JSON, overwriting...");
            }
        }

        messages.messages.push(newMessage);

        fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), (err) => {
            if (err) {
                console.error("Failed to write to messages file:", err);
            }
        });
    });

    // Broadcast to all connected clients
    const payload = JSON.stringify({ type: "message", message: newMessage });
    for (let id in clients) {
        clients[id].send(payload);
    }
}

async function translateText(text, sourceLang, targetLang) {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            q: text,
            source: sourceLang,
            target: targetLang,
            format: "text"
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.data.translations[0].translatedText;
}

app.get("/messages", (req, res) => {
    fs.readFile(messagesFile, "utf8", (err, data) => {
        if (err) {
            console.error("Failed to read messages:", err);
            return res.status(500).json({ error: "Unable to load messages" });
        }

        try {
            const messages = JSON.parse(data);
            res.json(messages);
        } catch (e) {
            console.error("Corrupt JSON:", e);
            res.status(500).json({ error: "Corrupt messages file" });
        }
    });
});

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});