/* =====================================================================
   Marcou Jogou — página do cliente
   ===================================================================== */
let db = carregar();
let dataSel = hojeISO();
let filtro = "todas";
let selecao = null;        // { quadraId, inicio, fim }
let ultimaReserva = null;  // reserva recém-criada (mostra o comprovante)
let telefoneBusca = "";
let codigoBusca = "";
let quadraInfo = null;      // quadra cujo topo foi clicado

const elDias = document.getElementById("dias");
const elFiltros = document.getElementById("filtros");
const elAgenda = document.getElementById("agenda");
const elPainel = document.getElementById("painel");

/* ---------- utilidades ---------- */
function avisar(texto) {
    const t = document.getElementById("toast");
    t.textContent = texto;
    t.classList.add("visivel");
    clearTimeout(avisar.timer);
    avisar.timer = setTimeout(() => t.classList.remove("visivel"), 2600);
}
function quadrasVisiveis() {
    return db.quadras.filter(q => q.ativa && (filtro === "todas" || q.modalidade === filtro));
}
function quadraPorId(id) { return db.quadras.find(q => q.id === id); }

/* ---------- abas ---------- */
document.querySelectorAll(".aba").forEach(botao => {
    botao.addEventListener("click", () => abrirAba(botao.dataset.aba));
});
function abrirAba(nome) {
    document.querySelectorAll(".aba").forEach(b => b.setAttribute("aria-selected", b.dataset.aba === nome));
    document.getElementById("sec-reservar").classList.toggle("oculto", nome !== "reservar");
    document.getElementById("sec-minhas").classList.toggle("oculto", nome !== "minhas");
    if (nome === "minhas") renderMinhas();
}

/* ---------- dias ---------- */
function renderDias() {
    elDias.innerHTML = "";
    for (let i = 0; i < 14; i++) {
        const iso = somarDias(hojeISO(), i);
        const d = deISO(iso);
        const b = document.createElement("button");
        b.className = "dia";
        b.setAttribute("aria-pressed", iso === dataSel);
        b.innerHTML = "<small>" + (i === 0 ? "hoje" : DIAS_CURTOS[d.getDay()]) + "</small><strong>" + d.getDate() + "</strong>";
        b.title = dataExtensa(iso);
        b.addEventListener("click", () => {
            dataSel = iso; selecao = null; ultimaReserva = null;
            renderTudo();
        });
        elDias.appendChild(b);
    }
}

/* ---------- filtros ---------- */
function renderFiltros() {
    const presentes = [...new Set(db.quadras.filter(q => q.ativa).map(q => q.modalidade))];
    const opcoes = [["todas", "Todas"]].concat(presentes.map(m => [m, MODALIDADES[m].nome]));
    elFiltros.innerHTML = "";
    opcoes.forEach(([valor, texto]) => {
        const b = document.createElement("button");
        b.className = "filtro";
        b.textContent = texto;
        b.setAttribute("aria-pressed", filtro === valor);
        b.addEventListener("click", () => {
            filtro = valor;
            if (selecao && !quadrasVisiveis().some(q => q.id === selecao.quadraId)) selecao = null;
            renderTudo();
        });
        elFiltros.appendChild(b);
    });
}

/* ---------- agenda ---------- */
function renderAgenda() {
    const quadras = quadrasVisiveis();
    elAgenda.style.gridTemplateColumns = "64px repeat(" + quadras.length + ", minmax(118px, 1fr))";
    elAgenda.innerHTML = '<div class="canto"></div>';

    quadras.forEach(q => {
        const m = MODALIDADES[q.modalidade];
        const cab = document.createElement("button");
        cab.className = "col-quadra" + (quadraInfo === q.id ? " ativa" : "");
        cab.innerHTML = desenhoQuadra(q.modalidade) + "<h3>" + q.nome + "</h3><p>" + m.nome + " · " + m.piso + "</p>";
        cab.setAttribute("aria-label", "Ver detalhes e horários livres de " + q.nome);
        cab.addEventListener("click", () => abrirQuadra(q.id));
        elAgenda.appendChild(cab);
    });

    for (let h = HORA_ABRE; h < HORA_FECHA; h++) {
        const nobre = h >= HORA_NOBRE || fimDeSemana(dataSel);
        elAgenda.insertAdjacentHTML("beforeend", '<div class="hora' + (nobre ? " nobre" : "") + '">' + hh(h) + "</div>");

        quadras.forEach(q => {
            const estado = estadoHorario(db, q.id, dataSel, h);
            const cel = document.createElement("button");
            cel.className = "celula " + estado;
            const selecionada = selecao && selecao.quadraId === q.id && h >= selecao.inicio && h < selecao.fim;
            if (selecionada) cel.classList.add("selecionada");

            if (estado === "livre") {
                cel.innerHTML = '<span class="preco">' + dinheiro(precoHora(q, dataSel, h)).replace(",00", "") + "</span>";
                cel.setAttribute("aria-label", q.nome + ", " + hh(h) + ", livre, " + dinheiro(precoHora(q, dataSel, h)));
                cel.addEventListener("click", () => escolherHorario(q.id, h));
            } else {
                cel.disabled = true;
                cel.textContent = estado === "reservada" ? "Ocupado" : estado === "bloqueada" ? "Manutenção" : "—";
                cel.setAttribute("aria-label", q.nome + ", " + hh(h) + ", indisponível");
            }
            if (selecionada) cel.setAttribute("aria-pressed", "true");
            elAgenda.appendChild(cel);
        });
    }
}

/* Clique num horário livre: ele vira o horário de início e o painel mostra as opções de duração */
function escolherHorario(quadraId, hora) {
    ultimaReserva = null;
    quadraInfo = null;
    if (selecao && selecao.quadraId === quadraId && selecao.inicio === hora) {
        selecao = null; // clicou de novo no mesmo início: desmarca
    } else {
        selecao = { quadraId, inicio: hora, fim: hora + 1 };
    }
    renderAgenda();
    renderPainel();
    levarAoPainel();
}

/* Durações possíveis a partir do início escolhido: 1h, 2h ou 3h, se os horários seguintes estiverem livres */
function opcoesDuracao(quadra, inicio) {
    const opcoes = [];
    let bloqueadoEm = null;
    for (let n = 1; n <= MAX_HORAS; n++) {
        const h = inicio + n - 1;
        if (bloqueadoEm === null) {
            if (h >= HORA_FECHA) bloqueadoEm = "fecha às " + hh(HORA_FECHA);
            else if (estadoHorario(db, quadra.id, dataSel, h) !== "livre") bloqueadoEm = "ocupado às " + hh(h);
        }
        opcoes.push({ horas: n, fim: inicio + n, livre: bloqueadoEm === null, motivo: bloqueadoEm,
            valor: precoReserva(quadra, dataSel, inicio, inicio + n) });
    }
    return opcoes;
}

function levarAoPainel() {
    if (window.innerWidth <= 980) elPainel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Clique no topo da coluna: mostra a quadra e os próximos horários livres do dia */
function abrirQuadra(quadraId) {
    quadraInfo = quadraId;
    selecao = null;
    ultimaReserva = null;
    renderAgenda();
    renderPainel();
    levarAoPainel();
}

function renderInfoQuadra() {
    const q = quadraPorId(quadraInfo);
    const m = MODALIDADES[q.modalidade];
    const livres = [];
    for (let h = HORA_ABRE; h < HORA_FECHA; h++) {
        if (estadoHorario(db, q.id, dataSel, h) === "livre") livres.push(h);
    }
    elPainel.innerHTML =
        desenhoQuadra(q.modalidade).replace('class="mini-quadra"', 'class="mini-quadra grande"') +
        "<h2>" + q.nome + "</h2>" +
        '<dl class="resumo">' +
        "<div><dt>Modalidade</dt><dd>" + m.nome + "</dd></div>" +
        "<div><dt>Piso</dt><dd>" + m.piso + "</dd></div>" +
        "<div><dt>Jogadores</dt><dd>" + m.jogadores[0] + " a " + m.jogadores[1] + "</dd></div>" +
        '<div><dt>Hora normal</dt><dd class="mono">' + dinheiro(q.preco) + "</dd></div>" +
        '<div><dt>Hora nobre</dt><dd class="mono">' + dinheiro(q.precoNobre) + "</dd></div>" +
        "</dl>" +
        '<span class="rotulo">Horários livres em ' + dataExtensa(dataSel) + "</span>" +
        (livres.length
            ? '<div class="horarios-livres" id="horarios-livres"></div>'
            : '<p class="vazio">Nenhum horário livre neste dia. Escolha outro dia acima.</p>');
    const caixa = document.getElementById("horarios-livres");
    livres.forEach(h => {
        const b = document.createElement("button");
        b.className = "chip-hora mono";
        b.textContent = hh(h);
        b.addEventListener("click", () => escolherHorario(q.id, h));
        if (caixa) caixa.appendChild(b);
    });
}

/* ---------- painel lateral ---------- */
function renderPainel() {
    if (ultimaReserva) return renderComprovante();
    if (quadraInfo && !selecao) return renderInfoQuadra();

    if (!selecao) {
        elPainel.innerHTML =
            "<h2>Sua reserva</h2>" +
            '<p class="vazio">Clique num horário livre para começar. Depois você escolhe se quer jogar 1, 2 ou 3 horas.</p>' +
            '<p class="dica" style="margin-top:12px">Clique no nome de uma quadra para ver os detalhes e os horários livres dela.</p>' +
            '<p class="dica">Depois das 18h e nos fins de semana vale o preço de horário nobre.</p>';
        return;
    }

    const q = quadraPorId(selecao.quadraId);
    const m = MODALIDADES[q.modalidade];
    elPainel.innerHTML =
        "<h2>Sua reserva</h2>" +
        '<p class="dica" style="margin:-6px 0 12px">' + q.nome + " · " + m.piso + " · " + dataExtensa(dataSel) + "</p>" +
        '<span class="rotulo">Quanto tempo você quer jogar?</span>' +
        '<div class="duracoes" id="duracoes" role="group" aria-label="Duração"></div>' +
        '<dl class="resumo" id="resumo-reserva"></dl>' +
        '<p class="dica">Pagamento na recepção ou por Pix até o horário do jogo.</p>' +
        '<form id="form-reserva" novalidate>' +
        campo("nome", "Nome de quem reserva", "text", 'autocomplete="name"') +
        campo("telefone", "Telefone (WhatsApp)", "tel", 'inputmode="tel" placeholder="(41) 99999-0000"') +
        campo("jogadores", "Número de jogadores", "number", 'min="' + m.jogadores[0] + '" max="' + m.jogadores[1] + '" value="' + m.jogadores[0] + '"') +
        '<label class="checar"><input type="checkbox" id="f-politica"> <span>Sei que posso cancelar sem custo até 2 horas antes.</span></label>' +
        '<span class="erro" id="erro-politica" style="display:block;color:var(--perigo);font-size:12px;margin:-8px 0 10px"></span>' +
        '<label class="checar"><input type="checkbox" id="f-lgpd"> <span>Concordo em compartilhar meu nome e telefone com o gestor da quadra, só para esta reserva.</span></label>' +
        '<span class="erro" id="erro-lgpd" style="display:block;color:var(--perigo);font-size:12px;margin:-8px 0 10px"></span>' +
        '<details style="margin:-4px 0 14px;font-size:13px"><summary>Como usamos seus dados</summary><p style="margin:6px 0 0">' + TEXTO_PRIVACIDADE + "</p></details>" +
        '<button class="botao largo" type="submit">Confirmar reserva</button>' +
        "</form>" +
        '<div class="acoes"><button class="botao secundario pequeno" id="limpar">Escolher outro horário</button></div>';

    renderDuracao();
    document.getElementById("f-jogadores").addEventListener("input", atualizarResumo);
    document.getElementById("form-reserva").addEventListener("submit", confirmarReserva);
    document.getElementById("limpar").addEventListener("click", () => { selecao = null; renderAgenda(); renderPainel(); });
}

/* Atualiza só os botões de duração e o resumo, sem apagar o que já foi digitado no formulário */
function renderDuracao() {
    const q = quadraPorId(selecao.quadraId);
    const caixa = document.getElementById("duracoes");
    caixa.innerHTML = "";
    opcoesDuracao(q, selecao.inicio).forEach(op => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "duracao";
        b.setAttribute("aria-pressed", selecao.fim === op.fim);
        b.innerHTML = "<strong>" + op.horas + (op.horas === 1 ? " hora" : " horas") + "</strong>" +
            (op.livre
                ? '<span class="mono">' + hh(selecao.inicio) + "–" + hh(op.fim) + "</span><span>" + dinheiro(op.valor) + "</span>"
                : "<span>" + op.motivo + "</span>");
        if (!op.livre) b.disabled = true;
        b.addEventListener("click", () => {
            selecao.fim = op.fim;
            renderDuracao();
            renderAgenda();
        });
        caixa.appendChild(b);
    });

    atualizarResumo();
}

/* Resumo da reserva com a divisão do valor entre os jogadores.
   Atualiza sozinho quando o cliente muda a duração ou o número de jogadores. */
function atualizarResumo() {
    const q = quadraPorId(selecao.quadraId);
    const m = MODALIDADES[q.modalidade];
    const horas = selecao.fim - selecao.inicio;
    const total = precoReserva(q, dataSel, selecao.inicio, selecao.fim);
    let jogadores = Number(document.getElementById("f-jogadores").value);
    if (!(jogadores >= 1)) jogadores = m.jogadores[0];
    document.getElementById("resumo-reserva").innerHTML =
        '<div><dt>Horário</dt><dd class="mono">' + hh(selecao.inicio) + "–" + hh(selecao.fim) + " (" + horas + "h)</dd></div>" +
        '<div class="total"><dt>Total</dt><dd>' + dinheiro(total) + "</dd></div>" +
        '<div><dt>Cada jogador paga (' + jogadores + ')</dt><dd class="mono">' + dinheiro(valorPorJogador(total, jogadores)) + "</dd></div>";
}

function campo(id, rotulo, tipo, extra) {
    return '<div class="campo"><label for="f-' + id + '">' + rotulo + '</label>' +
        '<input id="f-' + id + '" type="' + tipo + '" ' + (extra || "") + '>' +
        '<span class="erro" id="erro-' + id + '"></span></div>';
}

function marcarErro(id, mensagem) {
    const input = document.getElementById("f-" + id);
    const erro = document.getElementById("erro-" + id);
    if (input) input.setAttribute("aria-invalid", mensagem ? "true" : "false");
    erro.textContent = mensagem || "";
    return !mensagem;
}

function confirmarReserva(evento) {
    evento.preventDefault();
    const q = quadraPorId(selecao.quadraId);
    const m = MODALIDADES[q.modalidade];
    const nome = document.getElementById("f-nome").value.trim();
    const tel = apenasDigitos(document.getElementById("f-telefone").value);
    const jogadores = Number(document.getElementById("f-jogadores").value);
    const aceitou = document.getElementById("f-politica").checked;
    const lgpd = document.getElementById("f-lgpd").checked;

    let ok = true;
    ok = marcarErro("nome", nome.split(" ").filter(Boolean).length < 2 ? "Informe nome e sobrenome." : "") && ok;
    ok = marcarErro("telefone", (tel.length < 10 || tel.length > 11) ? "Telefone com DDD, só números: 10 ou 11 dígitos." : "") && ok;
    ok = marcarErro("jogadores", (jogadores < m.jogadores[0] || jogadores > m.jogadores[1])
        ? m.nome + ": de " + m.jogadores[0] + " a " + m.jogadores[1] + " jogadores." : "") && ok;
    ok = marcarErro("politica", aceitou ? "" : "Marque para continuar.") && ok;
    ok = marcarErro("lgpd", lgpd ? "" : "Marque para continuar.") && ok;
    if (!ok) return;

    // confere de novo: alguém pode ter reservado enquanto o formulário estava aberto
    db = carregar();
    for (let h = selecao.inicio; h < selecao.fim; h++) {
        if (estadoHorario(db, q.id, dataSel, h) !== "livre") {
            avisar("Esse horário acabou de ser ocupado. Escolha outro.");
            selecao = null; renderTudo(); return;
        }
    }

    const reserva = {
        id: gerarCodigo(db), quadraId: q.id, data: dataSel,
        inicio: selecao.inicio, fim: selecao.fim,
        nome, telefone: tel, jogadores,
        valor: precoReserva(q, dataSel, selecao.inicio, selecao.fim),
        status: "pendente", pago: false, criadaEm: Date.now(),
        consentimento: { aceito: true, em: Date.now() }
    };
    db.reservas.push(reserva);
    salvar(db);
    ultimaReserva = reserva;
    selecao = null;
    renderAgenda();
    renderPainel();
}

function renderComprovante() {
    const r = ultimaReserva;
    const q = quadraPorId(r.quadraId);
    elPainel.innerHTML =
        "<h2>Reserva feita</h2>" +
        '<div class="comprovante"><small>Código da reserva</small><strong>' + r.id + "</strong>" +
        '<span class="status pendente">aguardando pagamento</span></div>' +
        '<dl class="resumo">' +
        "<div><dt>Quadra</dt><dd>" + q.nome + "</dd></div>" +
        "<div><dt>Dia</dt><dd>" + dataExtensa(r.data) + "</dd></div>" +
        '<div><dt>Horário</dt><dd class="mono">' + hh(r.inicio) + "–" + hh(r.fim) + "</dd></div>" +
        '<div class="total"><dt>Total</dt><dd>' + dinheiro(r.valor) + "</dd></div>" +
        "<div><dt>Cada jogador paga (" + r.jogadores + ')</dt><dd class="mono">' + dinheiro(valorPorJogador(r.valor, r.jogadores)) + "</dd></div></dl>" +
        '<p class="dica">Mostre o código na recepção. Para ver esta reserva depois, use “Minhas reservas” com o telefone e o código.</p>' +
        '<div class="acoes"><a class="botao" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;text-align:center" href="' + linkGrupo(r, q) + '">Dividir com o grupo no WhatsApp</a>' +
        '<button class="botao secundario" id="ver">Minhas reservas</button>' +
        '<button class="botao secundario" id="nova">Fazer outra reserva</button></div>';
    document.getElementById("nova").addEventListener("click", () => { ultimaReserva = null; renderPainel(); });
    document.getElementById("ver").addEventListener("click", () => {
        telefoneBusca = r.telefone;
        codigoBusca = r.id;
        document.getElementById("busca-telefone").value = formatarTelefone(r.telefone);
        document.getElementById("busca-codigo").value = r.id;
        abrirAba("minhas");
    });
}

/* ---------- minhas reservas ---------- */
document.getElementById("form-busca").addEventListener("submit", evento => {
    evento.preventDefault();
    const tel = apenasDigitos(document.getElementById("busca-telefone").value);
    const codigo = document.getElementById("busca-codigo").value.trim().toUpperCase();
    const erro = document.getElementById("erro-busca");
    if (tel.length < 10 || !codigo) { erro.textContent = "Digite o telefone com DDD e o código da reserva."; return; }
    erro.textContent = "";
    telefoneBusca = tel;
    codigoBusca = codigo;
    renderMinhas();
});

function podeCancelar(r) {
    if (r.status === "cancelada") return false;
    const inicio = deISO(r.data); inicio.setHours(r.inicio, 0, 0, 0);
    return inicio.getTime() - Date.now() > ANTECEDENCIA_CANCELAR * 3600000;
}

function renderMinhas() {
    const lista = document.getElementById("lista-minhas");
    lista.innerHTML = "";
    if (!telefoneBusca) return;
    db = carregar();
    const minhas = db.reservas.filter(r => r.telefone === telefoneBusca)
        .sort((a, b) => (a.data + hh(a.inicio)).localeCompare(b.data + hh(b.inicio)));

    // só mostra se o código pertence a uma reserva desse telefone (protege a privacidade de quem reservou)
    if (!minhas.some(r => r.id === codigoBusca)) {
        lista.innerHTML = '<li class="cartao">Não encontramos reservas com esses dados. Confira o telefone e o código, ou faça uma reserva na aba Reservar.</li>';
        return;
    }
    minhas.forEach(r => {
        const q = quadraPorId(r.quadraId);
        const li = document.createElement("li");
        li.className = "item-reserva";
        const rotuloStatus = r.status === "pendente" ? "aguardando pagamento" : r.status;
        li.innerHTML =
            '<div class="quando">' + dataExtensa(r.data).split(",")[1] + "<small>" + hh(r.inicio) + "–" + hh(r.fim) + "</small></div>" +
            "<div><h4>" + q.nome + " · " + MODALIDADES[q.modalidade].nome + "</h4>" +
            "<p>" + r.id + " · " + dinheiro(r.valor) + " (" + dinheiro(valorPorJogador(r.valor, r.jogadores)) + " por jogador) · " + '<span class="status ' + r.status + '">' + rotuloStatus + "</span></p></div>" +
            "<div></div>";
        const area = li.lastChild;
        if (podeCancelar(r)) {
            const b = document.createElement("button");
            b.className = "botao perigo pequeno";
            b.textContent = "Cancelar";
            b.addEventListener("click", () => {
                if (b.dataset.confirmar) {
                    r.status = "cancelada";
                    salvar(db);
                    avisar("Reserva " + r.id + " cancelada.");
                    renderMinhas(); renderAgenda();
                } else {
                    b.dataset.confirmar = "1";
                    b.textContent = "Confirmar cancelamento";
                }
            });
            area.appendChild(b);
        } else if (r.status !== "cancelada") {
            area.innerHTML = '<span class="pago">Cancelamento só até 2h antes</span>';
        }
        if (r.status !== "cancelada") {
            const a = document.createElement("a");
            a.className = "botao secundario pequeno";
            a.target = "_blank";
            a.rel = "noopener";
            a.href = linkGrupo(r, q);
            a.textContent = "Dividir no WhatsApp";
            a.style.cssText = "text-decoration:none;display:inline-block;margin-left:6px";
            area.appendChild(a);
        }
        lista.appendChild(li);
    });

    // LGPD: o cliente pode apagar os próprios dados
    const rodape = document.createElement("li");
    rodape.className = "cartao";
    rodape.innerHTML = '<p class="dica" style="margin:0 0 10px">Seus dados ficam só para esta reserva. Se quiser, apague-os: ' +
        "as reservas futuras serão canceladas e as demais perdem seu nome e telefone.</p>";
    const apagar = document.createElement("button");
    apagar.className = "botao perigo pequeno";
    apagar.textContent = "Apagar meus dados";
    apagar.addEventListener("click", () => {
        if (!apagar.dataset.confirmar) { apagar.dataset.confirmar = "1"; apagar.textContent = "Confirmar: apagar meus dados"; return; }
        apagarDadosPessoais(db, telefoneBusca);
        salvar(db);
        telefoneBusca = ""; codigoBusca = "";
        document.getElementById("busca-telefone").value = "";
        document.getElementById("busca-codigo").value = "";
        avisar("Seus dados foram apagados.");
        renderMinhas(); renderAgenda();
    });
    rodape.appendChild(apagar);
    lista.appendChild(rodape);
}

/* ---------- tudo junto ---------- */
function renderTudo() { renderDias(); renderFiltros(); renderAgenda(); renderPainel(); }

// se o gestor mudar algo em outra aba, a agenda se atualiza sozinha
window.addEventListener("storage", e => {
    if (e.key === CHAVE) { db = carregar(); renderAgenda(); if (!document.getElementById("sec-minhas").classList.contains("oculto")) renderMinhas(); }
});

renderTudo();
