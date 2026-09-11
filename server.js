const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🗄️ CONEXÃO COM O BANCO DE DADOS
const db = new sqlite3.Database(path.join(__dirname, "banco.db"));

// 🕐 GERA A GRADE DE HORÁRIOS CONFORME O DIA DA SEMANA
// Terça, quarta e quinta: 9h às 19h | Sexta e sábado: 8h às 20h | Domingo e segunda: fechado
function gerarHorariosPorDia(dataString) {
    const [ano, mes, dia] = dataString.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia); // data local, evita bug de fuso horário
    const diaSemana = dataObj.getDay(); // 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado

    let horaAbertura, horaFechamento;

    if (diaSemana === 2 || diaSemana === 3 || diaSemana === 4) {
        // terça, quarta, quinta
        horaAbertura = 9;
        horaFechamento = 19;
    } else if (diaSemana === 5 || diaSemana === 6) {
        // sexta, sábado
        horaAbertura = 8;
        horaFechamento = 20;
    } else {
        // domingo e segunda: fechado
        return [];
    }

    const horarios = [];
    // último horário de início fica 1h antes de fechar, pra dar tempo de atender
    for (let hora = horaAbertura; hora < horaFechamento; hora++) {
        horarios.push(`${String(hora).padStart(2, "0")}:00`);
    }

    return horarios;
}

// 1. CRIA A TABELA DE HORÁRIOS FOCADA APENAS NA ALINE
db.run(`CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    horario TEXT,
    disponivel INTEGER DEFAULT 1,
    UNIQUE(data, horario)
)`, (err) => {
    if (!err) {
        // GERA A GRADE AUTOMÁTICA DO DIA ATUAL DO SEU SITE (10/09/2026) ASSIM QUE LIGA
        db.serialize(() => {
            const dataTeste = "2026-09-10";
            const horariosPadrao = gerarHorariosPorDia(dataTeste);

            horariosPadrao.forEach(horario => {
                db.run(
                    "INSERT OR IGNORE INTO horarios (data, horario, disponivel) VALUES (?, ?, 1)",
                    [dataTeste, horario]
                );
            });
            console.log("📅 Grade de horários da Aline gerada com sucesso para o dia 2026-09-10!");
        });
    } else {
        console.error("Erro ao criar tabela de horários:", err.message);
    }
});

// 2. CRIA A TABELA DE AGENDAMENTOS
db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    horario TEXT,
    cliente_nome TEXT,
    cliente_servico TEXT,
    Duracao TEXT
)`);


// 🌐 ROTA 1: BUSCA OS HORÁRIOS DO CALENDÁRIO (E CRIA SE O DIA FOR NOVO)
app.get('/api/horarios', (req, res) => {
    const dataSelecionada = req.query.data; 
    const horariosPadrao = gerarHorariosPorDia(dataSelecionada);

    // Busca todos os horários que continuam disponíveis (disponivel = 1) para mandar pro site
    const buscarHorarios = () => {
        const queryBusca = "SELECT horario FROM horarios WHERE data = ? AND disponivel = 1 ORDER BY horario ASC";

        db.all(queryBusca, [dataSelecionada], (err, rows) => {
            if (err) return res.status(500).json({ mensagem: "Erro ao buscar horários." });

            // Retorna a lista direto no formato que o script.js espera: [{ horario: "10:00" }, ...]
            res.json(rows);
        });
    };

    // Checa se o dia já tem horários criados
    db.get("SELECT id FROM horarios WHERE data = ? LIMIT 1", [dataSelecionada], (err, row) => {
        if (err) return res.status(500).json({ mensagem: "Erro no banco de dados." });

        // Se for um dia totalmente novo no calendário, cria a grade automaticamente na hora!
        if (!row) {
            db.serialize(() => {
                horariosPadrao.forEach(horario => {
                    db.run(
                        "INSERT OR IGNORE INTO horarios (data, horario, disponivel) VALUES (?, ?, 1)",
                        [dataSelecionada, horario]
                    );
                });

                // Só busca DEPOIS que todas as inserções acima já foram enfileiradas,
                // garantindo que os horários já existem antes de responder.
                buscarHorarios();
            });
        } else {
            buscarHorarios();
        }
    });
});


// 🛒 ROTA 2: SALVA O AGENDAMENTO E FAZ O HORÁRIO SUMIR DO SITE DINAMICAMENTE
app.post('/api/agendar', (req, res) => {
    const { data, horario, clienteNome, clienteServico } = req.body;

    // Verifica se o horário ainda está livre para evitar cliques duplos
    db.get("SELECT disponivel FROM horarios WHERE data = ? AND horario = ?", [data, horario], (err, row) => {
        if (err || !row || row.disponivel === 0) {
            return res.status(400).json({ mensagem: "Desculpe, este horário acabou de ser preenchido!" });
        }

        db.serialize(() => {
            // Insere o cliente na tabela de agendamentos
            db.run("INSERT INTO agendamentos (data, horario, cliente_nome, cliente_servico) VALUES (?, ?, ?, ?)", 
                [data, horario, clienteNome, clienteServico]);

            // Muda o status para 0 (faz sumir do site)
            db.run("UPDATE horarios SET disponivel = 0 WHERE data = ? AND horario = ?", [data, horario], function(err) {
                if (err) return res.status(500).json({ mensagem: "Erro ao processar agendamento." });
                res.json({ mensagem: "Agendamento realizado com sucesso! O horário foi retirado do sistema." });
            });
        });
    });
});


// 🔒 ROTA 3: PAINEL DA ADMINISTRAÇÃO SECRETA (Lista quem agendou)
app.get('/api/admin/agendamentos', (req, res) => {
    db.all("SELECT * FROM agendamentos ORDER BY data DESC, horario ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ mensagem: "Erro ao buscar agendamentos." });
        res.json(rows); 
    });
});


app.delete('/api/admin/limpar-antigos', (req, res) => {
    const hoje = new Date().toISOString().split('T')[0]; // Pega a data atual (AAAA-MM-DD)
    
    db.run("DELETE FROM horarios WHERE data < ?", [hoje], function(err) {
        if (err) return res.status(500).json({ mensagem: "Erro ao limpar horários antigos." });
        res.json({ mensagem: `Limpeza concluída! ${this.changes} horários de dias passados foram removidos do banco.`});
    });
});


// 🚀 LIGA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Tô na Aline rodando em http://localhost:${PORT}`);
});
