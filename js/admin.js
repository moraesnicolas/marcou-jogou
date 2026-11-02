/* =====================================================================
   Marcou Jogou — página do gestor
   ===================================================================== */
let db = carregar();
let dataSel = hojeISO();
let foco = null; // célula escolhida na agenda: { quadraId, hora }

const elPainel = document.getElementById("painel");

function avisar(texto) {
    const t = document.getElementById("toast");
    t.textContent = texto;
    t.classList.add("visivel");
    clearTimeout(avisar.timer);
    avisar.timer = setTimeout(() => t.classList.remove("visivel"), 2600);
}
function quadraPorId(id) { return db.quadras.find(q => q.id === id); }
function gravar(mensagem) { salvar(db); if (mensagem) avisar(mensagem); renderTudo(); }
const ROTULO_STATUS = { pendente: "aguardando", confirmada: "confirmada", cancelada: "cancelada" };

/* ---------- abas ---------- */
document.querySelectorAll(".aba").forEach(b => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
function abrirAba(nome) {
    document.querySelectorAll(".aba").forEach(b => b.setAttribute("aria-selected", b.dataset.aba === nome));
    ["agenda", "reservas", "quadras"].forEach(s =>
        document.getElementById("sec-" + s).classList.toggle("oculto", s !== nome));
}

/* ---------- dias ---------- */
function renderDias() {
    const el = document.getElementById("dias");
    el.innerHTML = "";
    for (let i = -1; i < 13; i++) {
        const iso = somarDias(hojeISO(), i);
        const d = deISO(iso);
        const b = document.createElement("button");
        b.className = "dia";
        b.setAttribute("aria-pressed", iso === dataSel);
        b.innerHTML = "<small>" + (i === 0 ? "hoje" : i === -1 ? "ontem" : DIAS_CURTOS[d.getDay()]) + "</small><strong>" + d.getDate() + "</strong>";
        b.addEventListener("click", () => { dataSel = iso; foco = null; renderTudo(); });
        el.appendChild(b);
    }
}

/* ---------- números do dia ---------- */
function renderPlacar() {
    const ativas = db.quadras.filter(q => q.ativa);
    const doDia = db.reservas.filter(r => r.data === dataSel && r.status !== "cancelada");
    const horasOcupadas = doDia.reduce((s, r) => s + (r.fim - r.inicio), 0);
    const horasTotais = ativas.length * (HORA_FECHA - HORA_ABRE);
    const ocupacao = horasTotais ? Math.round(horasOcupadas / horasTotais * 100) : 0;
    const previsto = doDia.reduce((s, r) => s + r.valor, 0);
    const aReceber = doDia.filter(r => !r.pago).reduce((s, r) => s + r.valor, 0);
    const pendentes = doDia.filter(r => r.status === "pendente").length;

    document.getElementById("placar").innerHTML =
        "<div><small>Reservas em " + dataExtensa(dataSel) + "</small><strong>" + doDia.length + "</strong></div>" +
        "<div><small>Ocupação (" + horasOcupadas + " de " + horasTotais + " h)</small><strong>" + ocupacao + "%</strong>" +
        '<div class="barra"><i style="width:' + ocupacao + '%"></i></div></div>' +
        "<div><small>Faturamento previsto</small><strong>" + dinheiro(previsto) + "</strong></div>" +
        "<div><small>A receber · " + pendentes + " a confirmar</small><strong>" + dinheiro(aReceber) + "</strong></div>";
}

/* ---------- agenda ---------- */
function renderAgenda() {
    const el = document.getElementById("agenda");
    const quadras = db.quadras.filter(q => q.ativa);
    el.style.gridTemplateColumns = "64px repeat(" + quadras.length + ", minmax(128px, 1fr))";
    el.innerHTML = '<div class="canto"></div>';
    quadras.forEach(q => {
        el.insertAdjacentHTML("beforeend", '<div class="col-quadra">' + desenhoQuadra(q.modalidade) +
            "<h3>" + q.nome + "</h3><p>" + MODALIDADES[q.modalidade].nome + "</p></div>");
    });

    for (let h = HORA_ABRE; h < HORA_FECHA; h++) {
        const nobre = h >= HORA_NOBRE || fimDeSemana(dataSel);
        el.insertAdjacentHTML("beforeend", '<div class="hora' + (nobre ? " nobre" : "") + '">' + hh(h) + "</div>");
        quadras.forEach(q => {
            const estado = estadoHorario(db, q.id, dataSel, h);
            const reserva = reservaNoHorario(db, q.id, dataSel, h);
            const cel = document.createElement("button");
            cel.className = "celula gestor " + estado;
            if (foco && foco.quadraId === q.id &&
                (reserva ? (foco.hora >= reserva.inicio && foco.hora < reserva.fim) : foco.hora === h)) {
                cel.classList.add("marcada");
            }

            if (reserva) {
                cel.classList.add(reserva.status);
                if (!reserva.pago) cel.classList.add("sem-pagamento");
                cel.innerHTML = h === reserva.inicio
                    ? '<span class="nome">' + reserva.nome.split(" ")[0] + " " + (reserva.nome.split(" ")[1] || "").charAt(0) + ".</span>" +
                      '<span class="preco">' + reserva.id + "</span>"
                    : '<span class="preco">↳ continua</span>';
            } else if (estado === "bloqueada") {
                cel.textContent = bloqueioNoHorario(db, q.id, dataSel, h).motivo;
            } else if (estado === "passou") {
                cel.textContent = "—";
            } else {
                cel.innerHTML = '<span class="preco">livre</span>';
            }
            cel.addEventListener("click", () => { foco = { quadraId: q.id, hora: h }; renderAgenda(); renderPainel(); });
            el.appendChild(cel);
        });
    }
}

/* ---------- painel de detalhes ---------- */
function renderPainel() {
    if (!foco) {
        elPainel.innerHTML = "<h2>Detalhes</h2>" +
            '<p class="vazio">Clique numa reserva para ver o cliente, confirmar ou registrar o pagamento.</p>' +
            '<p class="dica" style="margin-top:12px">Clique num horário livre para bloquear (manutenção, evento) ou reservar para quem está no balcão.</p>';
        return;
    }
    const q = quadraPorId(foco.quadraId);
    const reserva = reservaNoHorario(db, q.id, dataSel, foco.hora);
    const bloqueio = bloqueioNoHorario(db, q.id, dataSel, foco.hora);

    if (reserva) return painelReserva(reserva, q);
    if (bloqueio) {
        elPainel.innerHTML = "<h2>Horário bloqueado</h2>" + resumoHorario(q, foco.hora, foco.hora + 1) +
            "<p>Motivo: <strong>" + bloqueio.motivo + "</strong></p>" +
            '<div class="acoes"><button class="botao" id="liberar">Liberar horário</button></div>';
        document.getElementById("liberar").addEventListener("click", () => {
            db.bloqueios = db.bloqueios.filter(b => b !== bloqueio);
            gravar("Horário liberado.");
        });
        return;
    }
    if (horarioPassou(dataSel, foco.hora)) {
        elPainel.innerHTML = "<h2>Horário encerrado</h2>" + resumoHorario(q, foco.hora, foco.hora + 1) +
            '<p class="vazio">Esse horário já passou e ficou sem reserva.</p>';
        return;
    }
    painelLivre(q);
}

function resumoHorario(q, inicio, fim) {
    return '<dl class="resumo"><div><dt>Quadra</dt><dd>' + q.nome + "</dd></div>" +
        "<div><dt>Dia</dt><dd>" + dataExtensa(dataSel) + "</dd></div>" +
        '<div><dt>Horário</dt><dd class="mono">' + hh(inicio) + "–" + hh(fim) + "</dd></div></dl>";
}

function painelReserva(r, q) {
    elPainel.innerHTML =
        "<h2>" + r.nome + "</h2>" +
        '<p style="margin:-8px 0 12px"><span class="status ' + r.status + '">' + ROTULO_STATUS[r.status] + "</span> " +
        '<span class="pago">' + (r.pago ? "pago" : "pagamento pendente") + "</span></p>" +
        resumoHorario(q, r.inicio, r.fim).replace("</dl>",
            '<div><dt>Código</dt><dd class="mono">' + r.id + "</dd></div>" +
            '<div><dt>Telefone</dt><dd class="mono">' + formatarTelefone(r.telefone) + "</dd></div>" +
            "<div><dt>Jogadores</dt><dd>" + r.jogadores + "</dd></div>" +
            "<div><dt>Por jogador</dt><dd>" + dinheiro(valorPorJogador(r.valor, r.jogadores)) + "</dd></div>" +
            '<div class="total"><dt>Valor</dt><dd>' + dinheiro(r.valor) + "</dd></div></dl>") +
        '<div class="acoes" id="acoes-reserva"></div>';
    const acoes = document.getElementById("acoes-reserva");
    botoesReserva(r).forEach(b => acoes.appendChild(b));
}

/* botões que mudam a situação de uma reserva (usados no painel e na tabela) */
function botoesReserva(r, pequeno) {
    const lista = [];
    const criar = (texto, classe, acao) => {
        const b = document.createElement("button");
        b.className = "botao " + classe + (pequeno ? " pequeno" : "");
        b.textContent = texto;
        b.addEventListener("click", acao);
        lista.push(b);
        return b;
    };
    if (r.status === "pendente") criar("Confirmar", "", () => { r.status = "confirmada"; gravar("Reserva " + r.id + " confirmada."); });
    if (r.status !== "cancelada" && !r.pago) criar("Registrar pagamento", "secundario", () => { r.pago = true; gravar("Pagamento de " + r.id + " registrado."); });
    if (r.status !== "cancelada") {
        const b = criar("Cancelar", "perigo", () => {
            if (!b.dataset.confirmar) { b.dataset.confirmar = "1"; b.textContent = "Confirmar cancelamento"; return; }
            r.status = "cancelada"; gravar("Reserva " + r.id + " cancelada. O horário voltou a ficar livre.");
        });
    }
    return lista;
}

function painelLivre(q) {
    const m = MODALIDADES[q.modalidade];
    elPainel.innerHTML =
        "<h2>Horário livre</h2>" + resumoHorario(q, foco.hora, foco.hora + 1) +
        '<form id="form-balcao" novalidate>' +
        '<span class="rotulo">Reservar para cliente no balcão</span>' +
        '<div class="campo"><label for="b-nome">Nome</label><input id="b-nome"><span class="erro" id="e-nome"></span></div>' +
        '<div class="campo"><label for="b-tel">Telefone</label><input id="b-tel" inputmode="tel"><span class="erro" id="e-tel"></span></div>' +
        '<div class="campo"><label for="b-horas">Duração</label><select id="b-horas"></select></div>' +
        '<label class="checar"><input type="checkbox" id="b-pago"> Já pagou</label>' +
        '<label class="checar"><input type="checkbox" id="b-lgpd"> <span>O cliente concordou com o uso do nome e telefone só para esta reserva.</span></label>' +
        '<span class="erro" id="e-lgpd" style="display:block;color:var(--perigo);font-size:12px;margin:-8px 0 10px"></span>' +
        '<button class="botao largo" type="submit">Reservar horário</button></form>' +
        '<hr style="border:0;border-top:1px dashed var(--linha);margin:18px 0">' +
        '<span class="rotulo">Bloquear horário</span>' +
        '<div class="campo"><label for="b-motivo">Motivo</label><select id="b-motivo">' +
        "<option>Manutenção</option><option>Aula / escolinha</option><option>Evento</option><option>Chuva</option></select></div>" +
        '<button class="botao secundario largo" id="bloquear">Bloquear</button>';

    // durações possíveis: até 3h seguidas sem bater em outra reserva
    const sel = document.getElementById("b-horas");
    for (let n = 1; n <= MAX_HORAS; n++) {
        const h = foco.hora + n - 1;
        if (h >= HORA_FECHA || estadoHorario(db, q.id, dataSel, h) !== "livre") break;
        sel.insertAdjacentHTML("beforeend", '<option value="' + n + '">' + n + "h · " + hh(foco.hora) + "–" + hh(foco.hora + n) +
            " · " + dinheiro(precoReserva(q, dataSel, foco.hora, foco.hora + n)) + "</option>");
    }

    document.getElementById("form-balcao").addEventListener("submit", e => {
        e.preventDefault();
        const nome = document.getElementById("b-nome").value.trim();
        const tel = apenasDigitos(document.getElementById("b-tel").value);
        document.getElementById("e-nome").textContent = nome.length < 3 ? "Informe o nome." : "";
        document.getElementById("e-tel").textContent = (tel.length < 10 || tel.length > 11) ? "Telefone com DDD." : "";
        const lgpd = document.getElementById("b-lgpd").checked;
        document.getElementById("e-lgpd").textContent = lgpd ? "" : "Confirme a autorização do cliente.";
        if (nome.length < 3 || tel.length < 10 || tel.length > 11 || !lgpd) return;
        const horas = Number(sel.value);
        db.reservas.push({
            id: gerarCodigo(db), quadraId: q.id, data: dataSel, inicio: foco.hora, fim: foco.hora + horas,
            nome, telefone: tel, jogadores: m.jogadores[0],
            valor: precoReserva(q, dataSel, foco.hora, foco.hora + horas),
            status: "confirmada", pago: document.getElementById("b-pago").checked, criadaEm: Date.now(),
            consentimento: { aceito: true, em: Date.now(), origem: "balcão" }
        });
        gravar("Reserva criada para " + nome + ".");
    });
    document.getElementById("bloquear").addEventListener("click", () => {
        db.bloqueios.push({ quadraId: q.id, data: dataSel, hora: foco.hora, motivo: document.getElementById("b-motivo").value });
        gravar("Horário bloqueado.");
    });
}

/* ---------- tabela de reservas ---------- */
["r-busca", "r-status", "r-periodo"].forEach(id =>
    document.getElementById(id).addEventListener("input", renderTabela));

function renderTabela() {
    const termo = document.getElementById("r-busca").value.trim().toLowerCase();
    const status = document.getElementById("r-status").value;
    const periodo = document.getElementById("r-periodo").value;
    const hoje = hojeISO();

    const lista = db.reservas.filter(r => {
        if (periodo === "hoje" && r.data !== hoje) return false;
        if (periodo === "proximas" && r.data < hoje) return false;
        if (status === "areceber") { if (r.pago || r.status === "cancelada") return false; }
        else if (status !== "todas" && r.status !== status) return false;
        if (termo) {
            const texto = (r.nome + " " + r.id + " " + r.telefone).toLowerCase();
            if (!texto.includes(termo) && !r.telefone.includes(apenasDigitos(termo) || "§")) return false;
        }
        return true;
    }).sort((a, b) => (a.data + hh(a.inicio)).localeCompare(b.data + hh(b.inicio)));

    const corpo = document.getElementById("tabela-reservas");
    corpo.innerHTML = "";
    if (lista.length === 0) {
        corpo.innerHTML = '<tr><td colspan="9">Nenhuma reserva com esses filtros.</td></tr>';
    }
    lista.forEach(r => {
        const q = quadraPorId(r.quadraId);
        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td class="mono">' + r.id + "</td><td>" + dataExtensa(r.data) + '</td><td class="mono">' + hh(r.inicio) + "–" + hh(r.fim) +
            "</td><td>" + q.nome + "</td><td>" + r.nome + '<br><span class="pago mono">' + formatarTelefone(r.telefone) + "</span></td>" +
            '<td class="num">' + dinheiro(r.valor) + '</td><td><span class="status ' + r.status + '">' + ROTULO_STATUS[r.status] + "</span></td>" +
            '<td class="pago">' + (r.status === "cancelada" ? "—" : r.pago ? "pago" : "a receber") + '</td><td><div class="acoes-celula"></div></td>';
        const celula = tr.querySelector(".acoes-celula");
        botoesReserva(r, true).forEach(b => celula.appendChild(b));
        corpo.appendChild(tr);
    });
    const ativas = lista.filter(r => r.status !== "cancelada");
    document.getElementById("resumo-tabela").textContent =
        lista.length + " reserva(s) · " + dinheiro(ativas.reduce((s, r) => s + r.valor, 0)) + " em reservas ativas";
}

/* ---------- quadras ---------- */
function renderQuadras() {
    const grade = document.getElementById("grade-quadras");
    grade.innerHTML = "";
    db.quadras.forEach(q => {
        const m = MODALIDADES[q.modalidade];
        const div = document.createElement("div");
        div.className = "cartao-quadra" + (q.ativa ? "" : " inativa");
        div.innerHTML = desenhoQuadra(q.modalidade) +
            "<h3>" + q.nome + '</h3><p class="pago">' + m.nome + " · " + m.piso + " · " + m.jogadores[0] + "–" + m.jogadores[1] + " jogadores</p>" +
            '<div class="linha-2">' +
            '<div class="campo"><label for="p-' + q.id + '">Preço/hora</label><input id="p-' + q.id + '" type="number" min="0" step="5" value="' + q.preco + '"></div>' +
            '<div class="campo"><label for="n-' + q.id + '">Horário nobre</label><input id="n-' + q.id + '" type="number" min="0" step="5" value="' + q.precoNobre + '"></div>' +
            "</div>" +
            '<label class="checar"><input type="checkbox" id="a-' + q.id + '"' + (q.ativa ? " checked" : "") + "> Disponível para reserva</label>" +
            '<button class="botao pequeno">Salvar</button>';
        div.querySelector("button").addEventListener("click", () => {
            const preco = Number(document.getElementById("p-" + q.id).value);
            const nobre = Number(document.getElementById("n-" + q.id).value);
            if (!(preco > 0) || !(nobre > 0)) { avisar("Preços precisam ser maiores que zero."); return; }
            if (nobre < preco) { avisar("O preço nobre não pode ser menor que o normal."); return; }
            q.preco = preco; q.precoNobre = nobre; q.ativa = document.getElementById("a-" + q.id).checked;
            gravar(q.nome + " atualizada. Vale para novas reservas.");
        });
        grade.appendChild(div);
    });
}
document.getElementById("restaurar").addEventListener("click", function () {
    if (!this.dataset.confirmar) { this.dataset.confirmar = "1"; this.textContent = "Apagar tudo e restaurar exemplo"; return; }
    db = restaurarExemplo(); foco = null; this.dataset.confirmar = ""; this.textContent = "Restaurar dados de exemplo";
    renderTudo(); avisar("Dados de exemplo restaurados.");
});

/* ---------- tudo junto ---------- */
function renderTudo() { renderDias(); renderPlacar(); renderAgenda(); renderPainel(); renderTabela(); renderQuadras(); }

// reserva feita na página do cliente em outra aba aparece aqui sem recarregar
window.addEventListener("storage", e => { if (e.key === CHAVE) { db = carregar(); renderTudo(); } });

renderTudo();
