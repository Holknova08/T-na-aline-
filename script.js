
const pages =
    document.querySelectorAll(".page");

const menuLinks =
    document.querySelectorAll(".menu-link");

const navigationButtons =
    document.querySelectorAll("[data-page]");



function showPage(pageName) {


    pages.forEach(page => {

        page.classList.remove("active");

    });



    menuLinks.forEach(link => {

        link.classList.remove("active");

    });



    const selectedPage =
        document.getElementById(pageName);

    if (selectedPage) {

        selectedPage.classList.add("active");


        selectedPage.scrollTop = 0;
    }



    const selectedButton =
        document.querySelector(
            `.menu-link[data-page="${pageName}"]`
        );

    if (selectedButton) {

        selectedButton.classList.add("active");

    }



    menu.classList.remove("open");

}



menuLinks.forEach(link => {

    link.addEventListener("click", () => {

        const page =
            link.dataset.page;

        showPage(page);

    });

});



navigationButtons.forEach(button => {

    button.addEventListener("click", () => {

        const page =
            button.dataset.page;

        showPage(page);

    });

});



const menu =
    document.getElementById("menu");

const menuMobile =
    document.getElementById("menuMobile");


menuMobile.addEventListener("click", () => {

    menu.classList.toggle("open");

});



const whatsappNumber =
    "5511985205076";



function openWhatsApp(message) {

    const encodedMessage =
        encodeURIComponent(message);

    const url =
        `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.location.href = url;

}



const whatsappButton =
    document.getElementById("whatsappButton");

const contactWhatsapp =
    document.getElementById("contactWhatsapp");

const floatingWhatsapp =
    document.getElementById("floatingWhatsapp");


const defaultMessage =
    "Olá, Aline! 🌷 Gostaria de saber mais sobre os serviços.";


whatsappButton.addEventListener(
    "click",
    () => {

        openWhatsApp(defaultMessage);

    }
);


contactWhatsapp.addEventListener(
    "click",
    () => {

        openWhatsApp(defaultMessage);

    }
);


floatingWhatsapp.addEventListener(
    "click",
    () => {

        openWhatsApp(defaultMessage);

    }
);



/* =====================================
   AGENDAMENTO TÔ NA ALINE
===================================== */

const servicos = document.querySelectorAll(".service-row");

const passoData = document.getElementById("passoData");
const passoHorario = document.getElementById("passoHorario");
const passoDados = document.getElementById("passoDados");

const calendarDays = document.getElementById("calendarDays");
const calendarTitle = document.getElementById("calendarTitle");

const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

const horariosContainer = document.getElementById("horarios");

const nomeInput = document.getElementById("nome");
const observacaoInput = document.getElementById("observacao");

const confirmarAgendamento =
    document.getElementById("confirmarAgendamento");

const dataEscolhidaTexto =
    document.getElementById("dataEscolhidaTexto");

const resumoServico =
    document.getElementById("resumoServico");

const resumoData =
    document.getElementById("resumoData");

const resumoHorario =
    document.getElementById("resumoHorario");


let servicoSelecionado = null;
let dataSelecionada = null;
let horarioSelecionado = null;

let dataAtual = new Date();

const hoje = new Date();

hoje.setHours(0, 0, 0, 0);


const nomesMeses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
];


/* =====================================
   PASSO 1
===================================== */

servicos.forEach(servico => {

    servico.addEventListener("click", () => {

        servicos.forEach(item => {
            item.classList.remove("selected");
        });

        servico.classList.add("selected");

        servicoSelecionado =
            servico.dataset.service;

        dataSelecionada = null;
        horarioSelecionado = null;

        passoData.classList.remove(
            "booking-step-hidden"
        );

        passoHorario.classList.add(
            "booking-step-hidden"
        );

        passoDados.classList.add(
            "booking-step-hidden"
        );

        renderizarCalendario();

        passoData.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    });

});


/* =====================================
   CALENDÁRIO
===================================== */

function renderizarCalendario() {

    calendarDays.innerHTML = "";

    const ano =
        dataAtual.getFullYear();

    const mes =
        dataAtual.getMonth();

    calendarTitle.textContent =
        `${nomesMeses[mes]} ${ano}`;


    const primeiroDia =
        new Date(
            ano,
            mes,
            1
        ).getDay();


    const quantidadeDias =
        new Date(
            ano,
            mes + 1,
            0
        ).getDate();


    for (
        let i = 0;
        i < primeiroDia;
        i++
    ) {

        const vazio =
            document.createElement("span");

        calendarDays.appendChild(vazio);

    }


    for (
        let dia = 1;
        dia <= quantidadeDias;
        dia++
    ) {

        const botao =
            document.createElement("button");

        botao.type = "button";

        botao.textContent = dia;


        const data =
            new Date(
                ano,
                mes,
                dia
            );

        data.setHours(0, 0, 0, 0);


        const dataFormatada =
            `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;


        if (data < hoje) {

            botao.disabled = true;

        }


        if (
            data.getTime() ===
            hoje.getTime()
        ) {

            botao.classList.add("today");

        }


        if (
            dataSelecionada ===
            dataFormatada
        ) {

            botao.classList.add("selected");

        }


        botao.addEventListener(
            "click",
            () => {

                selecionarData(
                    dataFormatada,
                    botao
                );

            }
        );


        calendarDays.appendChild(
            botao
        );

    }

}


/* =====================================
   SELECIONAR DATA
===================================== */

function selecionarData(
    data,
    botao
) {

    dataSelecionada = data;

    horarioSelecionado = null;


    document
        .querySelectorAll(".calendar-days button")
        .forEach(item => {
            item.classList.remove("selected");
        });


    botao.classList.add("selected");


    const partes =
        data.split("-");


    dataEscolhidaTexto.textContent =
        `Data escolhida: ${partes[2]}/${partes[1]}/${partes[0]}`;


    passoHorario.classList.remove(
        "booking-step-hidden"
    );

    passoDados.classList.add(
        "booking-step-hidden"
    );


    carregarHorarios(data);


    passoHorario.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =====================================
   BUSCAR HORÁRIOS
===================================== */

async function carregarHorarios(data) {

    horariosContainer.innerHTML =
        `<p class="schedule-message">
            Carregando horários...
        </p>`;


    try {

        const resposta =
            await fetch(
                `/api/horarios?data=${data}`
            );


        if (!resposta.ok) {

            throw new Error(
                "Erro ao buscar horários"
            );

        }


        let horarios =
            await resposta.json();


        /*
         * IMPORTANTE:
         * Se for hoje, remove automaticamente
         * os horários que já passaram.
         */

        if (data === formatarData(hoje)) {

            horarios =
                horarios.filter(item => {

                    return horarioAindaDisponivel(
                        item.horario
                    );

                });

        }


        renderizarHorarios(horarios);


    } catch (erro) {

        console.error(erro);

        horariosContainer.innerHTML =
            `<p class="schedule-message">
                Não foi possível carregar os horários.
            </p>`;

    }

}


/* =====================================
   VERIFICAR HORÁRIO
===================================== */

function horarioAindaDisponivel(horario) {

    const agora =
        new Date();

    const [hora, minuto] =
        horario.split(":").map(Number);


    const horarioDoDia =
        new Date();

    horarioDoDia.setHours(
        hora,
        minuto,
        0,
        0
    );


    return horarioDoDia > agora;

}


/* =====================================
   MOSTRAR HORÁRIOS
===================================== */

function renderizarHorarios(horarios) {

    horariosContainer.innerHTML = "";


    if (
        !horarios ||
        horarios.length === 0
    ) {

        horariosContainer.innerHTML =
            `<p class="schedule-message">
                Nenhum horário para esta data
            </p>`;

        return;

    }


    horarios.forEach(item => {

        const botao =
            document.createElement("button");

        botao.type = "button";

        botao.className =
            "horario-button";

        botao.textContent =
            item.horario;


        botao.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".horario-button"
                    )
                    .forEach(item => {

                        item.classList.remove(
                            "selected"
                        );

                    });


                botao.classList.add(
                    "selected"
                );


                horarioSelecionado =
                    item.horario;


                mostrarDados();

            }
        );


        horariosContainer.appendChild(
            botao
        );

    });

}


/* =====================================
   PASSO 4
===================================== */

function mostrarDados() {

    passoDados.classList.remove(
        "booking-step-hidden"
    );


    resumoServico.textContent =
        `✨ Serviço: ${servicoSelecionado}`;


    const partes =
        dataSelecionada.split("-");


    resumoData.textContent =
        `📅 Data: ${partes[2]}/${partes[1]}/${partes[0]}`;


    resumoHorario.textContent =
        `🕐 Horário: ${horarioSelecionado}`;


    verificarFormulario();


    passoDados.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =====================================
   VALIDAR NOME
===================================== */

nomeInput.addEventListener(
    "input",
    verificarFormulario
);


function verificarFormulario() {

    confirmarAgendamento.disabled =
        !(
            servicoSelecionado &&
            dataSelecionada &&
            horarioSelecionado &&
            nomeInput.value.trim()
        );

}


/* =====================================
   CONFIRMAR → WHATSAPP
===================================== */

confirmarAgendamento.addEventListener(
    "click",
    () => {

        if (
            !servicoSelecionado ||
            !dataSelecionada ||
            !horarioSelecionado ||
            !nomeInput.value.trim()
        ) {

            return;

        }


        const nome =
            nomeInput.value.trim();


        const observacao =
            observacaoInput.value.trim();


        const partes =
            dataSelecionada.split("-");


        const dataFormatada =
            `${partes[2]}/${partes[1]}/${partes[0]}`;


        let mensagem =
`Olá, Aline! 🌷

Gostaria de agendar um horário.

👤 Nome: ${nome}

✨ Serviço: ${servicoSelecionado}

📅 Data: ${dataFormatada}

🕐 Horário: ${horarioSelecionado}`;


        if (observacao) {

            mensagem +=
                `\n\n📝 Observação: ${observacao}`;

        }


        mensagem +=
            `\n\nAguardo a confirmação. 💕`;


        const numero =
            "5511999999999";


        const url =
            `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;


        window.location.href = url;

    }
);


/* =====================================
   MÊS ANTERIOR
===================================== */

prevMonth.addEventListener(
    "click",
    () => {

        const mesAnterior =
            new Date(
                dataAtual.getFullYear(),
                dataAtual.getMonth() - 1,
                1
            );


        const primeiroMesPermitido =
            new Date(
                hoje.getFullYear(),
                hoje.getMonth(),
                1
            );


        if (
            mesAnterior >=
            primeiroMesPermitido
        ) {

            dataAtual =
                mesAnterior;

            renderizarCalendario();

        }

    }
);


/* =====================================
   PRÓXIMO MÊS
===================================== */

nextMonth.addEventListener(
    "click",
    () => {

        dataAtual =
            new Date(
                dataAtual.getFullYear(),
                dataAtual.getMonth() + 1,
                1
            );

        renderizarCalendario();

    }
);


/* =====================================
   FORMATAR DATA
===================================== */

function formatarData(data) {

    return `${data.getFullYear()}-${String(
        data.getMonth() + 1
    ).padStart(2, "0")}-${String(
        data.getDate()
    ).padStart(2, "0")}`;

}


/* =====================================
   INÍCIO
===================================== */

renderizarCalendario();