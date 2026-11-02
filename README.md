# Marcou Jogou — protótipo de reserva de quadras

Protótipo navegável com duas páginas: **cliente** (`index.html`) e **gestor** (`admin.html`).
Feito só com HTML, CSS e JavaScript, sem bibliotecas. Funciona offline: as fontes ficam na pasta `fonts/`.

## Como abrir
1. Extraia a pasta.
2. Abra `index.html` no navegador (Chrome ou Edge).
3. Para testar os dois lados, abra `admin.html` em outra aba do mesmo navegador. Uma reserva feita como cliente aparece na hora na agenda do gestor.

Os dados ficam salvos no `localStorage` do navegador. Para voltar ao estado inicial, use **Quadras → Restaurar dados de exemplo**.

## Estrutura
```
marcou-jogou/
├── index.html        página do cliente
├── admin.html        página do gestor
├── css/estilo.css    estilo das duas páginas
├── js/dados.js       dados, regras de preço e funções compartilhadas
├── js/cliente.js     lógica da página do cliente
├── js/admin.js       lógica da página do gestor
└── fonts/            Big Shoulders, Instrument Sans e DM Mono (licença OFL)
```

## Requisitos funcionais

### Cliente
| Código | Requisito |
|---|---|
| RF01 | Ver a disponibilidade das quadras por dia, nos próximos 14 dias, das 7h às 23h. |
| RF02 | Filtrar as quadras por modalidade (society, beach tennis, futevôlei, padel). |
| RF03 | Ver o preço de cada horário, com preço nobre depois das 18h e nos fins de semana. |
| RF04 | Clicar num horário livre e escolher a duração: 1, 2 ou 3 horas. Opções que batem em outra reserva aparecem desativadas com o motivo. |
| RF05 | Clicar no topo de uma quadra para ver modalidade, piso, número de jogadores, preços e os horários livres do dia. |
| RF06 | Ver o resumo da reserva (quadra, dia, horário, total) antes de confirmar. |
| RF07 | Informar nome, telefone e número de jogadores, com validação por modalidade. |
| RF08 | Aceitar a política de cancelamento e autorizar o uso do nome e telefone (LGPD) antes de confirmar. |
| RF09 | Impedir reserva em horário ocupado, bloqueado ou que já passou, conferindo de novo no momento de confirmar. |
| RF10 | Receber um código de reserva ao confirmar. |
| RF11 | Consultar as próprias reservas pelo telefone **e** pelo código da reserva. |
| RF12 | Cancelar a própria reserva até 2 horas antes do horário. |
| RF24 | Ver quanto cada jogador paga (total ÷ jogadores, arredondado para cima) ao reservar, no comprovante e em Minhas reservas. |
| RF25 | Mandar para o grupo do WhatsApp um resumo da reserva com o valor por pessoa. |
| RF26 | Apagar os próprios dados pessoais em Minhas reservas. |

### Gestor
| Código | Requisito |
|---|---|
| RF13 | Ver a agenda do dia com todas as quadras e o nome de quem reservou. |
| RF14 | Ver os números do dia: reservas, ocupação, faturamento previsto e valor a receber. |
| RF15 | Abrir os detalhes de uma reserva (cliente, telefone, jogadores, valor, situação). |
| RF16 | Confirmar reservas que estão aguardando. |
| RF17 | Registrar o pagamento de uma reserva. |
| RF18 | Cancelar uma reserva, com confirmação em dois cliques. O horário volta a ficar livre. |
| RF19 | Reservar um horário livre para um cliente que está no balcão (exige a autorização do cliente para o uso dos dados). |
| RF20 | Bloquear um horário (manutenção, aula, evento, chuva) e liberar depois. |
| RF21 | Listar todas as reservas com busca por nome, código ou telefone e filtros por situação e período. |
| RF22 | Alterar o preço normal e o preço nobre de cada quadra. |
| RF23 | Desativar uma quadra, que deixa de aparecer para o cliente. |
| RF27 | Ver o valor por jogador nos detalhes de uma reserva. |

## Regras de negócio
- Funcionamento: 7h às 23h, horários de 1 hora.
- Preço nobre: a partir das 18h e o dia todo aos sábados e domingos.
- Máximo de 3 horas seguidas por reserva.
- Reserva feita pelo cliente nasce como **aguardando**; o gestor confirma e registra o pagamento.
- Cliente cancela sem custo até 2 horas antes.
- Divisão do valor: total ÷ número de jogadores, arredondado para cima ao centavo (ex.: R$ 160 ÷ 14 = R$ 11,43 por pessoa).
- Sem o aceite do uso de nome e telefone, a reserva não é confirmada.

## LGPD e privacidade
- Só coletamos o mínimo: nome, telefone e número de jogadores.
- O cliente precisa marcar o aceite do uso e do compartilhamento dos dados com o gestor. O aceite fica registrado na reserva (`consentimento`).
- Em **Minhas reservas** é preciso informar o telefone e o código da reserva, para ninguém ver reservas de outra pessoa só sabendo o número.
- O cliente pode apagar os próprios dados (**Apagar meus dados**): as reservas futuras são canceladas e as demais perdem nome e telefone.
- Na reserva feita no balcão, o gestor confirma que o cliente autorizou o uso dos dados.

## Arquitetura
Aplicação só de front-end, em três camadas:
- **Apresentação:** `index.html`, `admin.html` e `css/estilo.css`.
- **Lógica das telas:** `js/cliente.js` e `js/admin.js`.
- **Regras e dados compartilhados:** `js/dados.js` (preços, divisão do valor, códigos, LGPD e leitura/gravação no `localStorage`).

As duas páginas conversam pelo `localStorage`: quando uma grava, a outra recebe o evento `storage` e atualiza a tela.

## Integrantes (Marcou Jogou)
- **Nicolas:** Desenvolvedor
- **Gustavo:** Designer
- **Ruan:** Testador de Software

## Limitações do protótipo
- Não há login: a área do gestor é aberta por um link. Num sistema real ela teria acesso com senha.
- Os dados ficam só no navegador (`localStorage`); não há servidor nem banco de dados.
- O pagamento é apenas registrado; não há integração com Pix ou cartão.
- A divisão do pagamento calcula e compartilha o valor de cada jogador; o pagamento de cada um não é cobrado nem acompanhado.
- Como tudo fica no navegador, a exigência de telefone e código é só uma proteção de interface. Segurança de verdade exige servidor e login.
