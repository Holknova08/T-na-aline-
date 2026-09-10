CREATE TABLE horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data DATE NOT NULL,
    horario TIME NOT NULL,
    disponivel INTEGER DEFAULT 1
);

CREATE TABLE agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    servico TEXT NOT NULL,
    data DATE NOT NULL,
    horario TIME NOT NULL,
    observacao TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);