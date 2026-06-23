const express = require('express');
const session = require('express-session');
const http = require('http');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { User } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'segredo_super_seguro_do_stop',
  resave: false,
  saveUninitialized: false
}));

app.get('/login', (req, res) => res.render('login'));

app.get('/', (req, res) => res.render('inicio', { salas : salas }));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  
  if (user) {
    const isValid = bcrypt.compare(password, user.password);
    
    if (isValid) {
      req.session.userId = user.id;
      req.session.username = user.username;
      return res.redirect('/');
    }
  }
  res.send('Usuário ou senha inválidos');
});

app.post('/cadastro', async (req, res) => {
  const { username, password } = req.body;
  let user = await User.findOne({ where: { username } });
  
  if (user) {
    res.send('Usuário já existe');
  }
  else {
    await User.create({
      username,
      password // o hash é feito no db.js
    });
    user = await User.findOne({ where: { username } });
    req.session.userId = user.id;
    req.session.username = user.username;
    return res.redirect('/lobby');
  }
});

app.get('/criar-sala', (req, res) => {
  const idSala = Math.random().toString(36).substring(2, 8);
  
  salas[idSala] = {
    id: idSala,
    jogadores: ["pedro", "ana", "gabriel", "maria", "carlos", "sofia"]
  };

  console.log("sala criada com id: " + idSala)
  res.redirect('/jogo/' + idSala);
});

function requireAuth(req, res, next) {
    if(req.session.userId) next();
    else res.redirect('/login');
}

app.get('/lobby', requireAuth, (req, res) => {
  res.render('lobby', { username: req.session.username });
});

app.get('/jogo/:id', requireAuth, (req, res) => {
  const sala = req.params.id;
  if(salas[sala]) {
    res.render('jogo', { username: req.session.username, sala : salas[sala] });
  } else res.status(404).send("Sala não encontrada");
});

let salas = {}

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  socket.on('entrar_sala', (dados) => {
    const { sala, username } = dados;
    socket.join(sala);
    
    // Avisa apenas os usuários DENTRO da sala que alguém entrou
    // [PREENCHA AQUI: Use io.to().emit() para enviar o evento 'mensagem_chat' para a sala]
  });

  socket.on('sortear_letra', (sala) => {
    const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letraSorteada = alfabeto[Math.floor(Math.random() * alfabeto.length)];
    
    // Dispara a letra para todos da sala
    io.to(sala).emit('letra_sorteada', letraSorteada);
  });

  // DESAFIO 3: O Botão STOP!
  socket.on('gritar_stop', (dados) => {
    const { sala, username } = dados;
    // O evento abaixo deve avisar todos na sala para travarem seus inputs e enviarem as respostas.
    // [PREENCHA AQUI: Emita o evento 'fim_de_rodada' contendo o nome de quem gritou STOP]
  });
});

server.listen(3000, () => console.log('Servidor rodando na porta 3000'));
