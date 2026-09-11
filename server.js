const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataString || "")) {
        return [];
    }

    const [ano, mes, dia] = dataString.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia); // data local, evita bug de fuso horário

    if (
        dataObj.getFullYear() !== ano ||
        dataObj.getMonth() !== mes - 1 ||
        dataObj.getDate() !== dia
    ) {
        return [];
    }

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
    // O horário de fechamento também é oferecido para agendamento,
    // conforme a grade informada: terça a quinta até 19:00;
    // sexta e sábado até 20:00.
    for (let hora = horaAbertura; hora <= horaFechamento; hora++) {
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
    Duracao TEXT,
    cliente_telefone TEXT,
    observacao TEXT,
    cancel_token TEXT UNIQUE,
    status TEXT DEFAULT 'confirmado'
)`);

// Migração segura para bancos antigos que ainda não possuem os novos campos.
[
    "ALTER TABLE agendamentos ADD COLUMN cliente_telefone TEXT",
    "ALTER TABLE agendamentos ADD COLUMN observacao TEXT",
    "ALTER TABLE agendamentos ADD COLUMN cancel_token TEXT",
    "ALTER TABLE agendamentos ADD COLUMN status TEXT DEFAULT 'confirmado'"
].forEach(comando => {
    db.run(comando, () => {});
});

// Concilia dados antigos antes da trava: mantém o primeiro agendamento ativo
// e marca duplicidades antigas como canceladas, preservando o histórico.
db.run(`UPDATE agendamentos
    SET status = 'cancelado'
    WHERE status = 'confirmado'
    AND id NOT IN (
        SELECT MIN(id) FROM agendamentos
        WHERE status = 'confirmado'
        GROUP BY data, horario
    )`);

// Segunda camada de proteção: mesmo se a tabela de horários ficar fora de
// sincronia, o SQLite nunca aceitará dois agendamentos ativos no mesmo slot.
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamento_ativo
    ON agendamentos (data, horario)
    WHERE status = 'confirmado'`);


// 🌐 ROTA 1: BUSCA OS HORÁRIOS DO CALENDÁRIO (E CRIA SE O DIA FOR NOVO)
app.get('/api/horarios', (req, res) => {
    const dataSelecionada = req.query.data; 

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataSelecionada || "")) {
        return res.status(400).json({ mensagem: "Data inválida. Use o formato AAAA-MM-DD." });
    }

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

    // Garante a grade completa em toda consulta. O INSERT OR IGNORE
    // repõe somente horários ausentes e preserva os já agendados (disponivel = 0).
    // Antes, a grade só era criada quando não existia nenhuma linha para a data;
    // assim, uma data com grade incompleta nunca recebia os horários faltantes.
    db.serialize(() => {
        horariosPadrao.forEach(horario => {
            db.run(
                "INSERT OR IGNORE INTO horarios (data, horario, disponivel) VALUES (?, ?, 1)",
                [dataSelecionada, horario]
            );
        });

        // A consulta entra na fila depois das inserções, então a resposta
        // sempre contém a grade completa de horários disponíveis.
        buscarHorarios();
    });
});


// 🛒 ROTA 2: SALVA O AGENDAMENTO E FAZ O HORÁRIO SUMIR DO SITE DINAMICAMENTE
app.post('/api/agendar', (req, res) => {
    const { data, horario, clienteNome, clienteTelefone, clienteServico, observacao } = req.body;

    const horariosValidos = gerarHorariosPorDia(data);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(data || "") ||
        !horariosValidos.includes(horario) ||
        !String(clienteNome || "").trim() ||
        !String(clienteTelefone || "").trim() ||
        !String(clienteServico || "").trim()
    ) {
        return res.status(400).json({ mensagem: "Dados do agendamento inválidos." });
    }

    // Transação + UPDATE condicional: dois cliques simultâneos não conseguem
    // reservar o mesmo horário.
    db.serialize(() => {
        const cancelToken = crypto.randomBytes(24).toString("hex");
        db.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
            if (beginErr) return res.status(500).json({ mensagem: "Erro ao iniciar agendamento." });

            db.run(
                "UPDATE horarios SET disponivel = 0 WHERE data = ? AND horario = ? AND disponivel = 1",
                [data, horario],
                function (updateErr) {
                    if (updateErr || this.changes !== 1) {
                        return db.run("ROLLBACK", () => {
                            res.status(400).json({ mensagem: "Desculpe, este horário acabou de ser preenchido!" });
                        });
                    }

                    db.run(
                        "INSERT INTO agendamentos (data, horario, cliente_nome, cliente_servico, cliente_telefone, observacao, cancel_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmado')",
                        [data, horario, String(clienteNome).trim(), String(clienteServico).trim(), String(clienteTelefone).trim(), String(observacao || "").trim(), cancelToken],
                        (insertErr) => {
                            if (insertErr) {
                                return db.run("ROLLBACK", () => {
                                    res.status(500).json({ mensagem: "Erro ao salvar o agendamento." });
                                });
                            }

                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) {
                                    return db.run("ROLLBACK", () => {
                                        res.status(500).json({ mensagem: "Erro ao confirmar o agendamento." });
                                    });
                                }

                                res.json({ mensagem: "Agendamento realizado com sucesso! O horário foi retirado do sistema.", token: cancelToken });
                            });
                        }
                    );
                }
            );
        });
    });
});

// Link de cancelamento: mantém o histórico, altera o status e libera o horário.
app.get('/api/cancelar', (req, res) => {
    const token = String(req.query.token || "");
    if (!/^[a-f0-9]{48}$/.test(token)) {
        return res.status(400).send("Link de cancelamento inválido.");
    }

    db.get("SELECT data, horario, cliente_servico, status FROM agendamentos WHERE cancel_token = ?", [token], (findErr, agendamento) => {
        if (findErr) return res.status(500).send("Não foi possível processar o cancelamento.");
        if (!agendamento) return res.status(404).send("Agendamento não encontrado.");
        if (agendamento.status === "cancelado") return res.send("Este agendamento já foi cancelado e o horário já está disponível.");

        db.serialize(() => {
            db.run("BEGIN IMMEDIATE TRANSACTION", beginErr => {
                if (beginErr) return res.status(500).send("Não foi possível iniciar o cancelamento.");

                db.run(
                    "UPDATE agendamentos SET status = 'cancelado' WHERE cancel_token = ? AND status = 'confirmado'",
                    [token],
                    function (updateErr) {
                        if (updateErr || this.changes !== 1) {
                            return db.run("ROLLBACK", () => res.send("Este agendamento já foi cancelado e o horário já está disponível."));
                        }

                        db.run(
                            "UPDATE horarios SET disponivel = 1 WHERE data = ? AND horario = ?",
                            [agendamento.data, agendamento.horario],
                            releaseErr => {
                                if (releaseErr) return db.run("ROLLBACK", () => res.status(500).send("Não foi possível liberar o horário."));
                                db.run("COMMIT", commitErr => {
                                    if (commitErr) return res.status(500).send("Não foi possível confirmar o cancelamento.");
                                    const site = `${req.protocol}://${req.get("host")}`;
                                    res.send(`Agendamento cancelado com sucesso.<br><br>Serviço: ${agendamento.cliente_servico}<br>Horário liberado: ${agendamento.horario}<br><br><a href="${site}">Voltar ao site e escolher novamente</a>`);
                                });
                            }
                        );
                    }
                );
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
