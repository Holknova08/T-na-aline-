const sqlite3 = require("sqlite3").verbose();

const db =
    new sqlite3.Database("./banco.db");


const horarios = [

    ["2026-09-11", "09:00"],
    ["2026-09-11", "10:00"],
    ["2026-09-11", "11:00"],
    ["2026-09-11", "14:00"],
    ["2026-09-11", "15:00"],
    ["2026-09-11", "16:00"],

    ["2026-09-12", "09:00"],
    ["2026-09-12", "10:00"],
    ["2026-09-12", "13:00"],
    ["2026-09-12", "14:00"],
    ["2026-09-12", "15:00"]

];


const comando = db.prepare(`
    INSERT OR IGNORE INTO horarios
    (data, horario, disponivel)
    VALUES (?, ?, 1)
`);


horarios.forEach(
    horario => {

        comando.run(
            horario[0],
            horario[1]
        );

    }
);


comando.finalize();


console.log(
    "Horários cadastrados!"
);


db.close();