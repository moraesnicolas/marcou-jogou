/* =====================================================================
   Marcou Jogou — dados compartilhados entre a página do cliente e a do gestor.
   Tudo fica salvo no localStorage do navegador, então uma reserva feita em
   index.html aparece na hora em admin.html (abra os dois no mesmo navegador).
   ===================================================================== */

const CHAVE = "marcouJogou_v1";
const HORA_ABRE = 7;     // primeiro horário: 07:00
const HORA_FECHA = 23;   // último horário termina às 23:00
const HORA_NOBRE = 18;   // a partir das 18h (e fins de semana) vale o preço nobre
const MAX_HORAS = 3;     // limite de horas seguidas por reserva
const ANTECEDENCIA_CANCELAR = 2; // cliente cancela até 2h antes

/* Texto mostrado ao cliente sobre o uso dos dados (LGPD) */
const TEXTO_PRIVACIDADE = "Usamos só o seu nome e telefone, e só para fazer e gerenciar esta reserva. " +
    "Eles são compartilhados apenas com o gestor da quadra. Você pode consultar, cancelar e apagar " +
    "seus dados quando quiser, em “Minhas reservas”. Neste protótipo, os dados ficam salvos somente neste navegador.";

const MODALIDADES = {
    society: { nome: "Society", piso: "grama sintética", jogadores: [10, 14] },
    beach: { nome: "Beach tennis", piso: "areia", jogadores: [2, 4] },
    futevolei: { nome: "Futevôlei", piso: "areia", jogadores: [2, 4] },
    padel: { nome: "Padel", piso: "vidro e grama", jogadores: [2, 4] }
};

const QUADRAS_INICIAIS = [
    { id: "s1", nome: "Society 1", modalidade: "society", preco: 180, precoNobre: 240, ativa: true },
    { id: "s2", nome: "Society 2", modalidade: "society", preco: 160, precoNobre: 220, ativa: true },
    { id: "b1", nome: "Areia 1", modalidade: "beach", preco: 90, precoNobre: 120, ativa: true },
    { id: "b2", nome: "Areia 2", modalidade: "futevolei", preco: 90, precoNobre: 120, ativa: true },
    { id: "p1", nome: "Padel", modalidade: "padel", preco: 120, precoNobre: 160, ativa: true }
];

/* ---------- datas ---------- */
function hojeISO() { return paraISO(new Date()); }
function paraISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dia;
}
function deISO(iso) {
    const p = iso.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function somarDias(iso, n) { const d = deISO(iso); d.setDate(d.getDate() + n); return paraISO(d); }
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataExtensa(iso) {
    const d = deISO(iso);
    return DIAS_CURTOS[d.getDay()] + ", " + d.getDate() + " " + MESES[d.getMonth()];
}
function fimDeSemana(iso) { const w = deISO(iso).getDay(); return w === 0 || w === 6; }
function hh(h) { return String(h).padStart(2, "0") + ":00"; }
function dinheiro(v) { return "R$ " + v.toFixed(2).replace(".", ","); }

/* ---------- preço ---------- */
function precoHora(quadra, iso, hora) {
    return (hora >= HORA_NOBRE || fimDeSemana(iso)) ? quadra.precoNobre : quadra.preco;
}
function precoReserva(quadra, iso, inicio, fim) {
    let total = 0;
    for (let h = inicio; h < fim; h++) total += precoHora(quadra, iso, h);
    return total;
}

/* ---------- divisão do pagamento ---------- */
/* Valor de cada jogador: total ÷ jogadores, arredondado para cima ao centavo
   (assim a soma das partes nunca fica abaixo do total). Ex.: R$ 160 ÷ 14 = R$ 11,43 */
function valorPorJogador(total, jogadores) {
    const n = Number(jogadores);
    if (!(n >= 1)) return total;
    return Math.ceil(total / n * 100 - 1e-9) / 100;
}
/* Mensagem pronta para mandar no grupo do WhatsApp */
function mensagemGrupo(r, q) {
    const por = valorPorJogador(r.valor, r.jogadores);
    return "⚽ Quadra marcada!\n" +
        q.nome + " (" + MODALIDADES[q.modalidade].nome + ")\n" +
        dataExtensa(r.data) + ", " + hh(r.inicio) + "–" + hh(r.fim) + "\n" +
        "Total: " + dinheiro(r.valor) + " · " + r.jogadores + " jogadores = " + dinheiro(por) + " por pessoa\n" +
        "Código da reserva: " + r.id;
}
function linkGrupo(r, q) { return "https://wa.me/?text=" + encodeURIComponent(mensagemGrupo(r, q)); }

/* ---------- LGPD: apagar os dados pessoais de um telefone ---------- */
/* Reservas futuras são canceladas; todas as reservas daquele telefone perdem nome e telefone.
   Valor e situação de pagamento ficam, porque o gestor precisa deles para o caixa. */
function apagarDadosPessoais(db, telefone) {
    let total = 0;
    db.reservas.forEach(r => {
        if (!telefone || r.telefone !== telefone) return;
        if (r.status !== "cancelada" && !horarioPassou(r.data, r.inicio)) r.status = "cancelada";
        r.nome = "Dados removidos";
        r.telefone = "";
        r.consentimento = null;
        total++;
    });
    return total;
}

/* ---------- leitura e gravação ---------- */
function carregar() {
    try {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo) return JSON.parse(salvo);
    } catch (e) { /* sem localStorage: segue com dados de exemplo em memória */ }
    const db = { quadras: QUADRAS_INICIAIS.map(q => ({ ...q })), reservas: [], bloqueios: [] };
    semear(db);
    salvar(db);
    return db;
}
function salvar(db) {
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) { }
}
function restaurarExemplo() {
    try { localStorage.removeItem(CHAVE); } catch (e) { }
    return carregar();
}

/* Gera algumas reservas de exemplo para hoje e os próximos dias */
function semear(db) {
    const hoje = hojeISO();
    const nomes = ["Lucas Ferreira", "Bruna Costa", "Rafael Lima", "Camila Rocha", "Diego Martins",
        "Paula Nunes", "Thiago Alves", "Renata Souza", "Gustavo Pires", "Aline Dias", "Marcos Vieira", "Júlia Ramos"];
    const plano = [
        // [diasAPartirDeHoje, quadra, inicio, horas, status, pago]
        [0, "s1", 19, 1, "confirmada", true], [0, "s1", 20, 2, "confirmada", false],
        [0, "s2", 18, 1, "pendente", false], [0, "s2", 21, 1, "confirmada", true],
        [0, "b1", 8, 2, "confirmada", true], [0, "b1", 17, 1, "pendente", false],
        [0, "b2", 19, 2, "confirmada", true], [0, "p1", 7, 1, "confirmada", true],
        [0, "p1", 20, 1, "cancelada", false], [0, "p1", 12, 1, "confirmada", false],
        [1, "s1", 20, 1, "confirmada", false], [1, "b1", 18, 2, "pendente", false],
        [1, "p1", 19, 1, "confirmada", true], [2, "s2", 19, 2, "pendente", false],
        [2, "b2", 9, 1, "confirmada", true], [3, "s1", 21, 1, "confirmada", false]
    ];
    plano.forEach((p, i) => {
        const data = somarDias(hoje, p[0]);
        const quadra = db.quadras.find(q => q.id === p[1]);
        db.reservas.push({
            id: gerarCodigo(db),
            quadraId: p[1], data: data, inicio: p[2], fim: p[2] + p[3],
            nome: nomes[i % nomes.length],
            telefone: "4199" + String(1000000 + i * 7311).slice(0, 7),
            jogadores: MODALIDADES[quadra.modalidade].jogadores[0],
            valor: precoReserva(quadra, data, p[2], p[2] + p[3]),
            status: p[4], pago: p[5], criadaEm: Date.now() - (i + 1) * 3600000
        });
    });
    db.bloqueios.push({ quadraId: "s2", data: hoje, hora: 9, motivo: "Manutenção do gramado" });
    db.bloqueios.push({ quadraId: "s2", data: hoje, hora: 10, motivo: "Manutenção do gramado" });
}

function gerarCodigo(db) {
    let codigo;
    do { codigo = "MJ-" + Math.floor(1000 + Math.random() * 9000); }
    while (db.reservas.some(r => r.id === codigo));
    return codigo;
}

/* ---------- consultas ---------- */
function reservaNoHorario(db, quadraId, data, hora) {
    return db.reservas.find(r => r.quadraId === quadraId && r.data === data &&
        r.status !== "cancelada" && hora >= r.inicio && hora < r.fim);
}
function bloqueioNoHorario(db, quadraId, data, hora) {
    return db.bloqueios.find(b => b.quadraId === quadraId && b.data === data && b.hora === hora);
}
function horarioPassou(data, hora) {
    const agora = new Date();
    const d = deISO(data); d.setHours(hora, 0, 0, 0);
    return d <= agora;
}
/* estado de uma célula da agenda: livre, reservada, bloqueada ou passou */
function estadoHorario(db, quadraId, data, hora) {
    if (bloqueioNoHorario(db, quadraId, data, hora)) return "bloqueada";
    if (reservaNoHorario(db, quadraId, data, hora)) return "reservada";
    if (horarioPassou(data, hora)) return "passou";
    return "livre";
}
function apenasDigitos(t) { return String(t).replace(/\D/g, ""); }
function formatarTelefone(t) {
    const d = apenasDigitos(t);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return t;
}

/* ---------- desenho das quadras (SVG com as linhas pintadas) ---------- */
const CORES_PISO = { society: "#3E7B4F", beach: "#D8C59A", futevolei: "#D8C59A", padel: "#2E5E9E" };
function desenhoQuadra(modalidade) {
    const piso = CORES_PISO[modalidade];
    const linha = (modalidade === "beach" || modalidade === "futevolei") ? "#8A6F3E" : "#F4F6F1";
    let linhas = "";
    if (modalidade === "society") {
        linhas = '<rect x="3" y="3" width="74" height="38" /><line x1="40" y1="3" x2="40" y2="41" />' +
            '<circle cx="40" cy="22" r="7" /><rect x="3" y="13" width="9" height="18" /><rect x="68" y="13" width="9" height="18" />';
    } else if (modalidade === "padel") {
        linhas = '<rect x="3" y="3" width="74" height="38" /><line x1="40" y1="1" x2="40" y2="43" stroke-width="2.4" />' +
            '<line x1="18" y1="3" x2="18" y2="41" /><line x1="62" y1="3" x2="62" y2="41" /><line x1="18" y1="22" x2="62" y2="22" />';
    } else {
        linhas = '<rect x="6" y="6" width="68" height="32" /><line x1="40" y1="2" x2="40" y2="42" stroke-width="2.4" />';
    }
    return '<svg class="mini-quadra" viewBox="0 0 80 44" aria-hidden="true"><rect width="80" height="44" rx="3" fill="' + piso +
        '"/><g fill="none" stroke="' + linha + '" stroke-width="1.4">' + linhas + '</g></svg>';
}
