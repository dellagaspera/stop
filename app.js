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

app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  next();
});

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

app.get('/logout', async (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// (err) => {
//     if (err) {
//       console.error("Erro ao fazer logout:", err);
//     }
    
//   }

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
    return res.redirect('/');
  }
});

app.get('/criar-sala', requireAuth, (req, res) => {
  const idSala = Math.random().toString(36).substring(2, 8);
  
  salas[idSala] = {
    id: idSala,
    jogadores: {}
  };

  io.emit('atualizar-lista-salas', salas);
  console.log("sala criada com id: " + idSala)
  res.redirect('/jogo/' + idSala);
});

function requireAuth(req, res, next) {
    if(req.session.userId) next();
    else res.redirect('/login');
}

app.get('/jogo/:id', requireAuth, (req, res) => {
  const sala = req.params.id;
  
  res.render('jogo', { username: req.session.username, sala : salas[sala] });
});
let salas = {}

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  socket.on('solicitar-lista-salas', () => {
    console.log("me pediram pra atualizar a lista");
    socket.emit('atualizar-lista-salas', salas);
  });

  socket.on('entrar_sala', (dados) => {
    const { sala, username } = dados;
    if(!salas[sala]) {
      socket.emit('erro', "Sala não encontrada");
      return;
    }
    if(salas[sala].jogadores[username]) {
      socket.emit('erro', "Você já está na sala");
      return;
    }
    
    socket.join(sala);

    if (Object.keys(salas[sala].jogadores).length === 0) {
      salas[sala].dono = username;
    }
    
    salas[sala].jogadores[username] = socket.id;
    
    io.to(sala).except(socket.id).emit('mensagem_recebida', { quemMandou : "Servidor", mensagem : `${username} entrou na sala.` });
    
    io.to(sala).emit('atualizar_sala', salas[sala]);
    io.emit('atualizar-lista-salas', salas);
  });

  socket.on('enviar_mensagem', (dados) => {
    const sala = dados.sala;
    const quemMandou = dados.quemMandou;
    const mensagem = dados.mensagem;

    console.log(`${quemMandou} disse "${mensagem}" para a sala ${sala}`);
    io.to(sala).emit('mensagem_recebida', { quemMandou, mensagem });
  });

  socket.on('disconnect', () => {
    Object.keys(salas).forEach(id => {
      const sala = salas[id];

      const username = Object.keys(sala.jogadores).find(
        (user) => sala.jogadores[user] === socket.id
      );

      if(username) {
        delete sala.jogadores[username];

        if(Object.keys(sala.jogadores).length === 0) {
          delete salas[id];
          io.emit('atualizar-lista-salas', salas);
          console.log("apagando sala " + id);
          return;
        }

        if(sala.dono === username) {
          sala.dono = Object.keys(sala.jogadores)[0];
        }
        
        console.log(sala);

        io.to(id).emit('atualizar_sala', sala);
        io.emit('atualizar-lista-salas', salas);
      }
    });
  });

  socket.on('sortear_letra', (sala) => {
    const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letraSorteada = alfabeto[Math.floor(Math.random() * alfabeto.length)];
    
    io.to(sala).emit('letra_sorteada', letraSorteada);
  });

  socket.on('gritar_stop', (dados) => {
    const { sala, username } = dados;
    io.to(sala).emit('fim_de_rodada', username);
  });
});

server.listen(3000, () => console.log('Servidor rodando na porta 3000'));
