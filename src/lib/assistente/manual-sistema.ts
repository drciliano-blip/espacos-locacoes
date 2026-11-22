// Manual do sistema para o Assistente de IA responder dúvidas de uso
// ("como gero um contrato?", "como dou baixa?", "como fecho o mês?").
// Levantado do código em 21/11/2026. Ao mudar uma tela, atualize aqui.

export const MANUAL_SISTEMA = `MANUAL DO SISTEMA ESPAÇOS & LOCAÇÕES (como usar cada tela; rótulos entre aspas são os textos dos botões)

0. REGRAS GERAIS
Perfis e páginas:
- admin: dashboard, assistente, agenda, pagamentos, eventos, financeiro, espaços, contas a pagar, usuários, calculadora de staff, credenciamento, buffet.
- financeiro: dashboard, assistente, pagamentos, eventos, financeiro, contas a pagar, buffet.
- operacional: dashboard, assistente, agenda, eventos, espaços, calculadora de staff, credenciamento, buffet.
- visualizador: só dashboard. socio: dashboard, agenda, eventos, financeiro, espaços — só leitura e só dos espaços vinculados a ele. credenciamento: só a tela Credenciamento.
- Valores a receber/em atraso/recebidos por evento: só admin, financeiro e sócio veem. Operacional cadastra eventos e contratos mas não vê a situação financeira dos clientes.
Menu: "Dashboard", "Assistente de IA", "Financeiro", "Agenda", "Calculadora de Staff", "Credenciamento", "Contas a Pagar / Pagas", "Espaços", "Buffet EL", "Eventos e Contratos", "Usuários". Rodapé: perfil e "Sair". A página "Relatórios" foi incorporada ao Financeiro. A tela "Pagamentos" (/pagamentos) existe mas não está no menu.
Seletor de espaço (topo, "Trocar de espaço"): a escolha vale para o sistema inteiro. "Todos os espaços" é só consulta — para lançar evento, conta ou receita escolha um espaço (mensagem: "Para realizar este lançamento, selecione primeiro um espaço no seletor do topo da tela.").
Topo: botão de tema claro/escuro; sino de notificações (contas e receitas em atraso; admin, financeiro, sócio).
Faixa de atraso (admin e financeiro): "N clientes com parcela vencida antes do evento" e "N contas a pagar vencidas"; botão abre a janela de cobrança; "Dispensar até amanhã".
Anexos: "Anexar documento" (rótulo varia), ícones "Visualizar", "Baixar", "Remover". Alguns aceitam "Colar texto (ex: WhatsApp)" → vira PDF. Fotos HEIC não são lidas pela IA: use "Tirar foto". "Ver documentos" busca todos os arquivos por nome/cliente, módulo e espaço.

1. DASHBOARD
"Em qual espaço você quer trabalhar?": "Todos os espaços", um botão por espaço, "Comparativo" (marcar espaços; gráficos Receita, Eventos e Ocupação por espaço + tabela comparativa). Cartões: "Receita do Mês" (só receita de evento; aporte e entradas manuais não contam), "Eventos Confirmados", "A Receber" e "Em Atraso" (só admin/financeiro/sócio). Gráficos por categoria e "Próximos Eventos Confirmados".

2. AGENDA (admin, operacional, sócio)
Abas "Agenda" e "Consultar Disponibilidade".
- Calendário mensal + lista ("Próximos Eventos", "Eventos Passados", mês). Clicar num dia filtra. "Mostrar cancelados/excluídos (N)" mostra os cancelados só para consulta (cancelado libera a data).
- "Exportar Relação": PDF (escolher colunas Data, Nome do Evento, Status, Valor Negociado, Contato; dá para tirar valores) ou Excel. Exporta o filtro da tela.
- "Pré-evento" (não aparece para sócio): "Nome do cliente*", "Telefone do cliente*" (com DDD), "Nome do evento", "Data*", "Espaço*", "Observações" → "Salvar pré-evento". Só segura a data: horário 00:00, valor R$ 0, sem parcelas. Se já houver evento no dia/espaço, só avisa.
- "Novo Evento" (precisa de espaço escolhido) abre o formulário de evento (item 3.1).
- Admin vê "N exclusões aguardando sua aprovação" → "Abrir e decidir".
- Google Calendar do espaço: ver item 6.
- Clicar num evento abre o painel do evento (item 3.2).
Consultar Disponibilidade: escolher espaços ("Selecionar todos"), "Período inicial"/"Período final" ou "Preencher por mês", "Dia da semana". Evento confirmado bloqueia a data; cancelado nunca; pré-evento não bloqueia mas aparece "Pré-reservada · cliente". Marcar datas → "Copiar Datas" (texto pronto para WhatsApp) ou "Exportar PDF" (sem valores nem clientes).

3. EVENTOS E CONTRATOS (admin, financeiro, operacional, sócio)
Abas "Contratos", "Documentos", "Receitas" (Receitas não aparece para o operacional).
Contratos: "Ver documentos", "Novo Contrato" (precisa de espaço; não aparece para sócio), busca "Buscar cliente ou nº contrato...", filtro de status. Cada contrato: número, cliente, valor, responsável, data, horário, "Assinado em", barra "Pagamento recebido %", entrada, saldo; botões "Detalhes e documentos" (observações e anexos "Anexar contrato", "Anexar comprovante de sinal") e "Gerar Contrato".
"Novo Contrato": bloco "Já tem a ficha do cliente preenchida?" ("Selecionar arquivo…", "Tirar foto" ou colar a conversa → "Extrair dados do texto": a IA preenche). Campos: cliente, CPF/CNPJ, espaço, data, status, horários, tipo, "Valor Total (R$)*", "Entrada (R$)", responsável, "Tipo de minuta" (Locação valor fixo / Parceria %), valor negociado, observações → "Gerar contrato com estes dados" ou "Salvar contrato".
Documentos: sub-abas "Documentos de Funcionários" ("Adicionar Funcionário": nome, cargo, espaço, telefone; anexos depois), "Contratos Espaços e Locação" (minutas oficiais de cada espaço, "Ver"/"Baixar"; anexadas em Espaços → Documentos) e "Fichas recebidas" (do formulário público /ficha-cliente: "Criar evento desta ficha" ou "Gerar contrato desta ficha").
Receitas (admin, financeiro, sócio): buscar o evento → "Anexar relatório" (Bar, Ingressos antecipados, Portaria, Alimentação, Outros; a IA lê o valor; gera receita pendente), "Nova Receita", plano de pagamento, outras receitas e relatórios anexados.

3.1 FORMULÁRIO DE EVENTO ("Novo Evento" / "Confirmar evento")
Pode preencher pela IA (ficha, foto ou texto colado → "Extrair dados do texto"; se o texto disser que parcelas já foram pagas, depois de salvar confirme com "Dar baixa").
Seções: Informações do Evento ("Qual é o tipo do evento?*" Locação ou Parceria — define o modelo de contrato; cliente; nome do evento; espaço; início da montagem; hora início/fim*; tipo; categoria Festivo/Corporativo/Audiovisual/Locação Portaria), Dados Pessoais, Dados da Empresa (pessoa jurídica), Capacidade e Financeiro ("Nº de Pessoas", "Valor (R$)*" — em Parceria "Valor envolvido" e "Condições da Parceria"; "Forma de Pagamento"; se "Parcelado": sinal, vencimento do saldo e parcelas com "Recalcular padrão", "Adicionar parcela"), Responsável ("Nome do Responsável*", "Telefone de Contato*"), Observações, Documentos (contrato, comprovante do sinal, CNH/RG de quem assina).
Salvar: "Salvar evento" (ou "Confirmar evento" quando vem de pré-evento). Data passada: aviso "Essa data já passou" com "Corrigir para dd/mm/aaaa" ou "Confirmar mesmo assim".
Plano padrão ao criar: Sinal hoje + Saldo 8 dias antes do evento (50/50), ou o sinal/vencimento/parcelas digitados. Depois de salvar: "Quer gerar o contrato agora?" → "Gerar contrato".

3.2 PAINEL DO EVENTO (clique no evento na Agenda ou em Espaços)
Abas "Detalhes" e "Documentos". Botões (não aparecem para sócio):
- Pré-evento: "Converter em evento confirmado" → abre o formulário completo e gera o plano de pagamento padrão (pré-evento antigo "PRÉ" que já tem parcelas só grava os dados).
- Evento: "Gerar Contrato" (tipo de minuta, valor negociado, observação → "Criar contrato" → gerador de contrato); se já existe, "Gerar documento do contrato".
- "Cancelar evento": 1) "Cancelar e manter a receita"; 2) "Cancelar e gerar reembolso" (Integral ou Parcial → gera conta paga "Reembolso de Evento", não apaga a receita); 3) "Excluir definitivamente" (só admin, com motivo).
- "Reativar evento" (cancelado volta a confirmado). "Editar" → "Salvar" (hora início e fim obrigatórias).
- Exclusão: operacional/financeiro usam "Excluir da agenda" com "Motivo*" — sai da Agenda e libera a data, mas o evento e o faturamento ficam até um admin decidir. Admin: "Excluir definitivamente" (apaga evento, receitas, reembolsos e contratos; auditado) ou, num pedido pendente, "Aprovar e excluir definitivamente" / "Recusar — voltar para a Agenda".
- Trocar Locação ↔ Parceria com contrato já gerado pede "Trocar modelo de contrato?"; o contrato já gerado não muda.
Detalhes: informações, capacidade/ocupação, financeiro, Plano de Pagamento (só admin/financeiro/sócio), responsável, vistoria, observações. O valor do evento acompanha a soma do plano (exceto Parceria).

3.3 PLANO DE PAGAMENTO E BAIXA DE PARCELA DE CLIENTE
Totais "Total do plano", "Recebido", "Em aberto". "Editar plano" (só admin): adicionar/remover parcelas → "Salvar plano".
Dar baixa: "Editar" na parcela → "Editar parcela": valor, vencimento, "Status" Pago, "Data de pagamento*" (não pode ser futura), hora, forma, observações, "Anexar comprovante" → "Salvar".
- "Pagamento parcial": informe o valor recebido agora; o restante vira nova parcela "(restante)".
- Forma "Repasse Sócio": escolha o sócio; registra repasse automático. Forma "Lucro de Sócio": escolha sócio/espaço e mês de referência.
- "Contabilizar em outro mês": o dinheiro entra hoje, mas o Financeiro conta no mês escolhido ("Mês do evento").
Também dá baixa por "Dar baixa" na janela de cobrança ou "Registrar recebimento" no Calendário Financeiro (Contas a Pagar).

3.4 GERAR CONTRATO
"Tipo de minuta" (Locação/Parceria) e "Versão da minuta" ("Sem staff" / "Com staff do espaço"). Usa a minuta mais recente anexada ao espaço (sem minuta: modelo genérico; sem CNPJ/responsável do espaço: campos do CEDENTE em branco). Revisar → "Gerar PDF" (cerca de 1 minuto) → "Baixar como PDF", "Baixar como DOC", "Copiar texto", "Editar campos novamente". O PDF fica anexado em Documentos.

4. FINANCEIRO (admin, financeiro, sócio; só admin e financeiro lançam)
Barra: "Conciliação Bancária", "Fechar Período", "+ Aporte", "+ Retirada" (precisam de espaço), "Exportar Relatório" (PDF simples ou Excel), filtro Semanal/Mensal/Trimestral/Semestral/Anual ou datas.
FECHAMENTO DO MÊS: escolher o espaço no topo → "Fechar Período" → "Mês" (mês a fechar) ou "Período personalizado" → conferir "Resultado Operacional", "Disponível p/ Distribuição" e a tabela de sócios → "Confirmar Fechamento". Regras: o período precisa ter terminado (até ontem) e não pode se sobrepor a outro fechamento. Depois de fechado, lançamentos pagos daquele período não podem ser editados ("Reabra o fechamento em Financeiro para editar"). "Histórico de Fechamentos": "Visualizar", "Baixar Excel", "Reabrir".
Seções: "Resumo Financeiro" (Obra e Operacional), "Resultado Operacional", "Obra" (aporte societário × despesas de obra), "Fundo de Caixa / Reservas" ("Criar Fundo"; em cada fundo "Adicionar", "Retirar", "Histórico", "Excluir" com saldo zero — fundo não é receita nem despesa), "Disponível para Distribuição" (acumulado: resultado − fundos − já retirado), "Sócios" (aportes, retiradas, retirado no mês), "Repasse aos sócios" (tabela por sócio com lucro do mês, parte, retirado, repassado, saldo anterior, a receber; "Registrar repasse").
"+ Aporte": espaço, sócio, data, valor, descrição, comprovante (entra pago, não conta como faturamento). "+ Retirada": espaço, sócio, data, valor, descrição, comprovante (a IA lê valor e data) → "Registrar retirada". Editar pelas listas "Ver Aportes"/"Ver Retiradas" (na retirada: "Este pagamento quita um repasse já registrado?" para não descontar duas vezes).
CONCILIAÇÃO BANCÁRIA (admin, financeiro): "Importar Extrato" (espaço + arquivo; OFX direto; CSV/XLS/XLSX/PDF lidos por IA) → "Confirmar importação". Situações: Conciliado, Não encontrado no sistema, Não encontrado no banco, Possível divergência, Possível duplicidade, Transferência entre contas, Ignorado. Por linha: "Criar lançamento" → "Criar e vincular", "Vincular a…", "Desvincular", "Desmarcar". "Classificar pendências em lote" → aplicar como lançamento, transferência ou ignorar → "Confirmar Classificação".

5. CONTAS A PAGAR / PAGAS (admin, financeiro)
Cartões "Total Geral", "Pagas", "Pendentes", "Atrasadas", "Clientes em Atraso" (abre a cobrança). Botões "Nova Conta", "Transferir para Fundo de Caixa", "Ver documentos". Visões "Lista"/"Calendário"; abas "Contas a Pagar", "Contas Pagas", "Em Atraso"; "Filtros" (categoria, subcategoria, origem, fornecedor, vencimento, pagamento, valor).
"Nova Conta": "Descrição *", "Valor (R$) *", "Vencimento *", "Tipo de despesa *" (Operacional, Obra, Financeiro, Retirada Sócio, Fundo de Caixa, Reembolso de Evento), "Subcategoria *", "Espaço vinculado *", sócio ou beneficiário, observações. "Documento (opcional)": arquivo, foto ou "Colar Texto WhatsApp" → a IA lê boleto/comprovante e preenche (não marca como paga). "Conta fixa — repetir todo mês" → "Lançar N meses". Se parecer duplicada, avisa "possível lançamento já existente" (não bloqueia) → "Salvar conta".
DAR BAIXA EM CONTA: "Dar baixa" → anexar o comprovante (obrigatório) → a IA lê data e hora do pagamento → "Confirmar pagamento". Comprovante já usado em outra conta: bloqueia com "Este comprovante já foi utilizado...".
Linha: "Reler comprovante", "Editar" (conta fixa: "Só esta conta" ou "Esta e as próximas ainda não pagas"), "Excluir" (conta paga ou em período fechado não pode), "Documentos". "Recalcular datas de todas pelos comprovantes".
"Transferir para Fundo de Caixa": espaço, valor, data, descrição, responsável → "Transferir para o Fundo" (não é despesa).
Calendário Financeiro: contas a pagar, a receber (parcelas de eventos confirmados) e pagos/recebidos; no dia: "Nova conta neste dia", "Dar baixa", "Registrar recebimento".
COBRANÇA DE CLIENTES ("Clientes em atraso"): seções "Evento a acontecer" (cobrar), "Evento já realizado" (conferir no extrato e dar baixa, ou cobrar) e "Sem evento vinculado". Por cliente: "Copiar mensagem de cobrança", botão que abre o WhatsApp com a mensagem pronta, "Dar baixa". "Exportar Excel".

6. ESPAÇOS (admin, operacional, sócio)
"Novo Espaço" (nome, endereço, capacidade, status, descrição, foto). Página do espaço: "Trocar foto", "Novo Evento", cartões Receita Confirmada / Ticket Médio / Ocupação; abas "Eventos" (lista ou calendário), "Documentos" ("Anexar alvará", "Outros documentos"; minutas "Locação — sem staff", "Locação — com staff", "Parceria" com "Anexar"/"Substituir"/"Ver"/"Apagar minuta"; "Dados legais" CNPJ e responsável — "Editar" só admin), "Financeiro" (plano de pagamento de todos os eventos, receita por mês) e "Atividades" (histórico).
Google Calendar (na página do espaço e na Agenda): "Conectar Google Calendar" (conta Google do espaço), "Reconectar" quando expira; conectado: "Novo evento" (título, data, início, fim), "Atualizar", "Desconectar".

7. CALCULADORA DE STAFF (admin, operacional)
Não salva nada. Funções (Barman, Chefe de Bar, Atendente de Bar, Segurança, Bombeiro, Policial, Técnico de Som, Técnico de Luz, Hostess, Recepção, Caixa, Limpeza, Chapelaria) com quantidade, valor unitário (até 8 h), hora extra (1/8 do unitário) e qtd. de horas extras → subtotal e "Total Geral". "Adicionar outra função", "Limpar tudo", "Exportar PDF".

8. CREDENCIAMENTO (admin, operacional, credenciamento)
Abas "Pessoas", "Escalas por evento" (não aparece para o perfil credenciamento), "Empresas".
"Nova ficha": nome, CPF, RG, nascimento, telefone, e-mail, "Função *", contratação (PF / MEI / empresa terceirizada), observações; situação (Ativo/Inativo/Vetado com motivo) e avaliação → "Salvar ficha" (gera o nº do staff). Documentos: RG ou CNH para todos; CNV para segurança; certificado para bombeiro civil; CCMEI/CNPJ para MEI; aviso de vencimento 30 dias antes. "Anotações".
Escalas: filtrar eventos → "Nº do staff ou nome" → "Escalar"; "Remover da escala"; documentação conferida na data do evento. Empresas: "Nova empresa".
O perfil credenciamento só cria/edita fichas e empresas e anexa documentos.

9. BUFFET EL (admin, financeiro, operacional) — negócio separado, não entra no financeiro dos espaços
Abas "Orçamentos" e "Cadastros e tabelas". "Novo orçamento": cliente, evento (convidados*), cardápio (comidas, bebidas, extras, restrições), "Tabela de referência" e "Opção da tabela" (sugere o preço), "Valor final (R$)*", condições, validade → "Salvar". Ações: "Editar", "PDF da proposta", "Duplicar", "Marcar como enviado", "Aprovado", "Perdido", "Reabrir". Cadastros: opções por grupo (ativar/desativar) e tabelas de pacotes (convidados × opção) — só admin e financeiro alteram preços.

10. USUÁRIOS (só admin)
"Novo Usuário": criar no Supabase (Authentication → Users → Add user), atualizar a lista (entra como Visualizador) e "Editar" para nome e nível de acesso. Sócio: marcar "Espaços que esse sócio pode ver". "Ativar"/"Desativar" (inativo não entra). Obs.: a "Matriz de Permissões" desta tela está desatualizada; vale a lista do item 0.

11. PAGAMENTOS (/pagamentos, fora do menu; admin, financeiro)
"Nova Entrada": "Receita de Evento", "Aporte Societário", "Outras Entradas" ou "Retorno do Fundo de Caixa" (não é receita). "Contabilizar em outro mês"; recebimento não pode ser no futuro. Tabela com filtros; "Editar Entrada" ("Substituir comprovante", "Excluir esta entrada").

12. FICHA DO CLIENTE (/ficha-cliente, pública, sem login)
O cliente preenche os dados (ou a IA lê de um documento) → aparece em Eventos e Contratos → Documentos → "Fichas recebidas".

13. ASSISTENTE DE IA
Comando por voz: botão de microfone ao lado da caixa de mensagem (botão flutuante, Consultas e Atendimentos); fale e a mensagem é enviada ao terminar. Funciona no Chrome/Edge/Android e Safari recentes; se o navegador não tiver, use o microfone do teclado do celular.
Botão redondo do assistente no canto de baixo de todas as telas (para quem tem acesso): abre o chat de Consultas por cima da tela atual; "Tela completa" leva à página do Assistente.
Aba "Atendimentos" (admin, operacional): um chat por cliente/orçamento; o assistente monta o orçamento de locação e de serviços, gera os PDFs, prepara mensagens para o cliente e pré-reserva/confirma na Agenda (com clique de confirmação); botão "Orçamento" para ajustar à mão. Aba "Consultas" (admin, financeiro, operacional): perguntas sobre agenda, atrasados, duplicados e conferência do mês.
Dúvidas jurídicas e de regulamentação de eventos (alvará, AVCB, brigada/bombeiro civil, segurança, ambulância, lotação, contrato de cessão, filmagem): pergunte em qualquer chat do assistente; ele responde pela base jurídica do escritório Fonseca Ciliano, citando a norma. É orientação interna: documento para terceiro passa pelo jurídico.
A resposta aparece enquanto é escrita, e a linha cinza mostra o que o assistente está fazendo ("Consultando a agenda...", "Pesquisando na internet..."). Em perguntas jurídicas e financeiras ele pensa mais (demora um pouco mais). Ele pode pesquisar na internet o que não está no sistema (normas novas, fornecedores, referências de eventos e produções), dizendo a fonte.
Gravar com um toque (Etapa 3): no cartão "Dar baixa", confira a data e a forma de pagamento e toque em "Confirmar baixa"; no cartão de conta, toque em "Lançar agora". Fica registrado no histórico de atividades como feito pelo Assistente de IA, e "Desfazer" volta como estava (enquanto a tela estiver aberta). Pagamento parcial, repasse de sócio, comprovante ou retirada de sócio: "Abrir para ajustar". Várias baixas na mesma resposta: "Confirmar as N baixas".
Anexos no chat: o clipe aceita foto, print de tela ou PDF (dúvida sobre uma tela, mensagem de erro, ficha, comprovante, boleto); a IA lê o arquivo e responde.
Cadastrar evento pela ficha do cliente: no chat do assistente, toque no clipe e anexe a foto/print/PDF da ficha (ou cole o texto, ou dite pelo microfone) → o assistente lê e mostra o cartão "Abrir cadastro do evento" → abre "Novo Evento" preenchido → conferir e "Salvar evento" → o sistema oferece "Gerar contrato". Se já houver pré-evento do cliente na data, ele sugere converter o pré-evento. Áudio de cliente ainda não é lido: ouça e dite pelo microfone.
Orçamento para cliente pelo botão do assistente: peça "faz um orçamento para ..." → cartão "Abrir e montar o orçamento" abre o atendimento já preenchido e o assistente monta o orçamento (admin e operacional).
Tarefas que o assistente prepara como cartão (a pessoa abre a janela do sistema já no ponto certo, confere e salva): pré-reservar data; converter pré-evento; gerar contrato; cancelar ou reagendar evento (não para sócio); dar baixa em parcela de cliente e lançar conta a pagar (admin e financeiro). Fechamento do mês, conciliação e exclusões continuam nas telas próprias.`
