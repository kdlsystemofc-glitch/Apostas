# SPORTS PREDICTOR V2 — FASE 1: AUDITORIA TÉCNICA E CIENTÍFICA CRÍTICA
## RELATÓRIO DO CONSELHO TÉCNICO MULTIDISCIPLINAR

---

### COMPOSIÇÃO DO CONSELHO TÉCNICO:
- **Principal Software Architect**
- **Football Data Scientist**
- **Senior Statistician**
- **UX Researcher**
- **UI Designer**
- **React Architect**
- **QA Engineer**

---

> **DIRETRIZ DA FASE 1:** NENHUM CÓDIGO-FONTE FOI ALTERADO. O objetivo desta auditoria é questionar rigorosamente todas as decisões arquiteturais, matemáticas, estatísticas, de usabilidade e de engenharia do sistema atual, estabelecendo a base científica para a versão V2.

---

## 1. PARECERES DOS ESPECIALISTAS DO CONSELHO TÉCNICO

### 1.1 Principal Software Architect
- **Arquitetura Client-Side Centralizada:** Toda a inteligência matemática (`predictionEngine.js`) roda no navegador do cliente (frontend React). Isso expõe 100% da propriedade intelectual (fórmulas, pesos, matrizes) no bundle JavaScript público (`dist/assets/index-*.js`).
- **Padrão de Acesso ao Banco de Dados (`base44Client.js` vs Supabase SDK Direct):** A aplicação usa um wrapper `base44Client.js` sobre o Supabase REST client. A chave anônima do Supabase fica exposta no cliente sem políticas de segurança no nível de linha (RLS - Row Level Security) configuradas no banco, permitindo que qualquer usuário autenticado leia ou sobrescreva partidas de outros usuários.
- **Acoplamento Monolítico:** A lógica de cálculo preditivo está diretamente acoplada à renderização de componentes React, dificultando a execução de simulações em lote ou testes automatizados via CLI/Node.js.

---

### 1.2 Football Data Scientist
- **Vício de Amostra Curta sem Contexto de Força (Oponente/ELO):** As estatísticas coladas do StatsHub representam apenas os últimos 5 a 10 jogos dos times. Se a Argentina enfrentou a Bolívia e a Alemanha enfrentou a França, o modelo trata os números brutos como equivalentes, ignorando completamente o **Rating ELO / Glicko2** do oponente.
- **Ausência de Mando de Campo Específico por Campeonato:** O motor aplica multiplicadores estáticos fixos ($+12\%$ escanteios casa, $+6\%$ gols casa, $-5\%$ cartões casa) independentemente da liga. Ligas com forte fator casa (ex: Bolívia na altitude) ou ligas neutras são tratadas com as mesmas taxas genéricas.
- **Desconsideração do Game Script (Estado do Placar):** Estatísticas brutas ignoram se um time chuta mais porque passou 80 minutos perdendo (Game Script Bias). Chutes quando empatado têm valor preditivo muito maior do que chutes quando já está vencendo por 3x0.

---

### 1.3 Senior Statistician
- **Erro de Terminologia entre EV+ e Odd Mínima Justa:** O sistema exibe "Odd Mínima (EV+)" calculando simplesmente $1 / P$. Matematicamente, $1 / P$ é a **Fair Odd (Odd Justa)**. O **Expected Value (Valor Esperado - EV)** só é calculado quando existe uma Odd de Casa de Apostas ($O_{\text{bookie}}$):
  $$EV = (P \cdot O_{\text{bookie}}) - 1$$
  Chamar a Odd Justa de "Odd Mínima EV+" é um erro conceitual estatístico.
- **Violação da Equi-dispersão de Poisson em Cartões e Faltas:** A Distribuição de Poisson assume rigorosamente que $\mu = \sigma^2$. No futebol, faltas e cartões apresentam **sobredispersão violenta** ($\sigma^2 \gg \mu$) devido à arbitragem e temperatura do jogo. Aplicar Poisson causa afunilamento excessivo nas caixas Over/Under. A distribuição correta deve ser a **Binomial Negativa** ou **Conway-Maxwell-Poisson**.
- **Parâmetro de Dixon-Coles Estático ($\rho = -0.13$):** O parâmetro de correlação para baixos placares $\rho$ foi fixado em $-0.13$ para todos os campeonatos. Estudos de Dixon & Coles (1997) demonstram que $\rho$ varia substancialmente de liga para liga e deve ser estimado por Máxima Verossimilhança (MLE) sobre a amostra histórica do campeonato.
- **Independência Simplicista no BTTS:** A probabilidade de Ambas Marcam é calculada como $(1 - e^{-xG_H}) \cdot (1 - e^{-xG_A})$, tratando o gol de cada time como evento independente. Na realidade, quando o visitante marca o primeiro gol, a probabilidade do mandante marcar aumenta significativamente devido ao comportamento tático reativo.

---

### 1.4 UX Researcher
- **Fricção Extrema no Parser Manual (Colar Texto):** O fluxo principal obriga o usuário a abrir o site do StatsHub, selecionar o time, copiar a tabela inteira, voltar à aplicação e colar o texto em um `textarea`. Isso gera erros de formatação frequentes e impede análises ágeis.
- **Falta de Feedback Claro na Falha de Ingestão:** Quando o usuário cola uma tabela com formato corrompido, o aviso apenas informa "formato não reconhecido", sem apontar qual linha ou coluna causou a falha no parser.

---

### 1.5 UI Designer
- **Poluição Visual e Repetição de Cards:** A aba de resultados exibe múltiplos cards com design idêntico empilhados verticalmente. Falta hierarquia de cor (as cores dos badges `green`, `yellow`, `red` competem visualmente com os botões primários da interface).
- **Contraste no Modo Escuro (WCAG AA):** Alguns textos secundários usam `text-slate-400` sobre fundos `slate-900`, resultando em uma razão de contraste inferior a $4.5:1$, violando a diretriz de acessibilidade WCAG 2.1 AA.

---

### 1.6 React Architect
- **Gerenciamento de Estado Fragmentado:** O estado da aplicação (`lastMatch`, `tab`, `matches`) está concentrado em `useState` locais no `Home.jsx` e `MatchDetail.jsx`, sem o uso de um store global (Zustand ou Redux) ou desacoplamento eficiente via TanStack Query para cache e invalidação.
- **Tamanho do Bundle JavaScript:** O build de produção gera um arquivo chunk único de `585 kB`, ultrapassando o limite recomendado de `500 kB`. Falta code-splitting via `React.lazy()` para as páginas secundárias (`MatchDetail`, `LeagueProfiles`, `Export`).

---

### 1.7 QA Engineer
- **Ausência de Error Boundaries:** Se ocorrer um erro não capturado dentro de um componente de resultado (ex: campo `results` corrompido no JSONB do banco), a tela inteira entra em "tela branca de erro" (White Screen of Death) sem exibir uma mensagem amigável de recuperação.
- **Falta de Testes Unitários de Regressão:** Não existem testes unitários (Vitest / Jest) para garantir que as funções de cálculo (`calcGols`, `calcCorners`, `calcResultado`) não sofram regressão em refatorações futuras.

---

## 2. MATRIZ DE PROBLEMAS ENCONTRADOS, GRAVIDADE E PRIORIDADE

| # | Problema Encontrado | Componente Afetado | Gravidade | Impacto | Prioridade |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Exposição da Propriedade Intelectual (Client-Side Engine):** Toda a matemática preditiva roda no navegador do cliente, permitindo cópia/engenharia reversa do bundle. | `predictionEngine.js` | **Crítica** | Segurança / IP | **P1 (Urgente)** |
| **2** | **Sobredispersão Ignorada (Poisson em Cartões/Faltas):** Uso de Poisson em dados de alta variância distorce as probabilidades de caixas Over/Under altos. | `predictionEngine.js` | **Alta** | Precisão Preditiva | **P1 (Urgente)** |
| **3** | **Confusão Conceitual entre Odd Justa e EV+:** Sistema rotula $1/P$ como "Odd Mínima (EV+)" sem comparar com a Odd real da casa de apostas. | `MarketBlock.jsx` / `BestBetsByMarket.jsx` | **Alta** | Confiabilidade Estatística | **P1 (Urgente)** |
| **4** | **Parâmetro Dixon-Coles ($\rho$) Hardcoded Estático:** Valor de $\rho = -0.13$ fixo para qualquer liga, ignorando taxas reais de empates específicos. | `predictionEngine.js` | **Média** | Precisão do 1X2 | **P2 (Média)** |
| **5** | **Ausência de Rating ELO / Força do Oponente:** O modelo trata amostras de 5 jogos contra adversários fortes ou fracos com o mesmo peso. | `predictionEngine.js` | **Alta** | Validade Estatística | **P2 (Média)** |
| **6** | **Fricção na Ingestão de Dados (Colar Texto):** Processo manual exigindo navegação externa e cópia/cola de tabelas brutas. | `StatsInput.jsx` | **Média** | Usabilidade / UX | **P2 (Média)** |
| **7** | **Bundle Size Elevado (> 500 kB):** Falta de divisão de código (code-splitting / `React.lazy`) para rotas secundárias. | `App.jsx` / `vite.config.js` | **Baixa** | Performance | **P3 (Baixa)** |
| **8** | **Ausência de Error Boundaries em React:** Falha em componente de resultado pode travar toda a aplicação em tela branca. | `App.jsx` | **Média** | Resiliência / QA | **P3 (Baixa)** |

---

## 3. MELHORIAS SUGERIDAS PARA A VERSÃO SPORTS PREDICTOR V2

### A. Arquitetura e Segurança
1. **Migração do Engine para Edge API Routes / Serverless:** Mover as funções preditivas para Serverless Functions / API Routes (Node.js), ocultando as fórmulas e pesos do cliente.
2. **Implementação de RLS no Supabase:** Configurar Row Level Security nas tabelas PostgreSQL para proteger as análises de cada usuário.

### B. Matemática e Estatística
1. **Implementação da Distribuição Binomial Negativa:** Substituir Poisson por Binomial Negativa com estimador de dispersão $\phi$ para os mercados de Cartões e Faltas.
2. **Cálculo Real de Expected Value (EV+):** Adicionar campos para entrada da Odd Real oferecida pela Casa de Apostas e calcular o valor esperado verdadeiro:
   $$EV = (P \cdot \text{Odd}_{\text{casa}}) - 1$$
   Destacar em verde apenas apostas onde $EV > +3\%$.
3. **Rating ELO / Glicko2 de Ajuste de Força:** Ajustar a expectativa de gols/cantos ponderando o peso do oponente enfrentado nos últimos jogos.

### C. Interface, UX e Performance
1. **Integração de Ingestão Inteligente / API de Dados:** Criar conector automático para buscar estatísticas dos times diretamente via nome/data, mantendo o colar de texto como fallback.
2. **Code-Splitting com `React.lazy()`:** Dividir as rotas do aplicativo para reduzir a carga inicial do bundle para menos de `150 kB`.
3. **Error Boundaries com Fallback UI:** Envolver as rotas e cards principais em Error Boundaries para capturar exceções com elegância.

---
Relatório oficial de auditoria técnica da Fase 1 produzido pelo Conselho Técnico V2. Nenhum código-fonte foi alterado.
