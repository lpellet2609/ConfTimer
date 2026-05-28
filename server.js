const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/control', (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));
app.get('/', (req, res) => res.redirect('/control'));

let state = {
  mode: 'stopwatch',
  duration: 300,
  elapsed: 0,
  status: 'idle'
};

let ticker = null;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function tick() {
  state.elapsed++;
  if (state.mode === 'countdown' && state.elapsed === state.duration) {
    state.status = 'finished';
  }
  broadcast({ type: 'state', ...state });
}

function startTicker() {
  if (!ticker) ticker = setInterval(tick, 1000);
}

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null; }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', ...state }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'setMode':
          if (state.status === 'idle') {
            state.mode = msg.mode;
            broadcast({ type: 'state', ...state });
          }
          break;
        case 'setDuration':
          if (state.status === 'idle') {
            state.duration = Math.max(1, msg.duration);
            broadcast({ type: 'state', ...state });
          }
          break;
        case 'start':
          if (state.status === 'idle' || state.status === 'paused') {
            state.status = 'running';
            startTicker();
            broadcast({ type: 'state', ...state });
          }
          break;
        case 'pause':
          if (state.status === 'running') {
            state.status = 'paused';
            stopTicker();
            broadcast({ type: 'state', ...state });
          }
          break;
        case 'reset':
          stopTicker();
          state.elapsed = 0;
          state.status = 'idle';
          broadcast({ type: 'state', ...state });
          break;
        case 'adjustDuration':
          if (state.mode === 'countdown') {
            state.duration = Math.max(1, state.duration + msg.delta);
            if (state.status === 'running' && state.elapsed >= state.duration) {
              state.status = 'finished';
            } else if (state.status === 'finished' && state.elapsed < state.duration) {
              state.status = 'running';
            }
            broadcast({ type: 'state', ...state });
          }
          break;
      }
    } catch (e) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Conftimer démarré sur le port ${PORT}`));
