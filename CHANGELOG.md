# CHANGELOG — SPORTS PREDICTOR V2

Todas as alterações notáveis no projeto **Sports Predictor** serão documentadas neste arquivo.

## [2.4.0] - 2026-08-28 — VERSÃO V2.4 (ENRIQUECIMENTO DE PARSER, HISTÓRICO H/A E NOTA DE ARQUITETURA DE DECOMPOSIÇÃO)

### 🚀 Destaques da Versão V2.4
- **Novo:** Parser Estendido (`parseStatsHubText`) com extração de cabeçalho de jogos (`_jogos_header`), mandos `H`/`A`, placares, datas e histórico jogo-a-jogo (`historico`).
- **Novo:** Cálculo de estatísticas descritivas do histórico: `media_casa`, `media_fora`, `media_recente` (decaimento exponencial $0.95^k$) e `desvio_padrao` por estatística.
- **Validação:** Testes unitários com sequências mistas de 20 jogos (ex: Fulham `H A H A H A A H A H H H A A A H A H A H`).
- **Nota Metodológica de Proteção de Sinal Binário (`decidirSubstituicao`):**
  Métricas de erro contínuo ($R^2$, MAE) podem melhorar enquanto a taxa de acerto direcional (Over/Under) piora (como demonstrado em Defesas do Goleiro e Cartões). Para qualquer substituição futura de modelo, a regra `decidirSubstituicao()` exige validação simultânea em ambas as dimensões (melhoria em $R^2$ SEM degradação da taxa de acerto binária). A seleção de hiperparâmetros (como $\lambda_{\text{ridge}}$) é feita exclusivamente no treino via validação cruzada 5-fold (zero vazamento de teste).

---

## [2.3.0] - 2026-08-24 — VERSÃO V2.3 (REGRESSÃO MULTIVARIADA OUT-OF-SAMPLE & TRATAMENTO DE CONFIABILIDADE)

### 🚀 Destaques da Versão V2.3
- **Novo:** Análise Estatística de Regressão Múltipla com Validação Cronológica Out-of-Sample (Split 80% Treino / 20% Teste) sobre 156 jogos reais.
- **Novo:** Classificação de Mercados por Confiabilidade Baseada em Evidência Estatística:
  - **Produção Normal (Confiáveis):** Gols Total, Cartões Total, Defesas do Goleiro.
  - **Baixa Confiabilidade ("⚠ EM ESTUDO"):** Escanteios Total, Chutes no Gol Total, Faltas Total, Chutes Totais.
- **Novo:** Badge e Card Explicativo "⚠ EM ESTUDO" na interface para orientar o usuário sobre mercados sob validação contínua.
- **Novo:** Botão de Reavaliação de Confiabilidade dos Mercados na `CalibrationView.jsx` com Teste Binomial ($p$-valor via aproximação de Abramowitz-Stegun) para decidir promoções futuras quando a amostra ultrapassar 300+ jogos.
- **Direção Futura:** Registro de fatores contextuais (árbitros, estado do jogo) para expansões futuras do modelo de dados.

---

## [2.0.0] - 2026-08-06 — VERSÃO V2.0 (RELEASE FINAL DE PRODUÇÃO)

### 🚀 Destaques da Versão V2.0
A versão 2.0 representa uma reconstrução matemática, arquitetural e visual completa do sistema.

### 📐 Modelagem Probabilística & Estatística (Fase 2 & 2.1)
- **Novo:** Matriz Dixon-Coles Bivariada $8 \times 8$ com parâmetro de correlação $\rho = -0.13$, corrigindo a subestimativa histórica de placares baixos ($0 \times 0$, $1 \times 0$).
- **Novo:** Ponderação Bayesiana (`bayesianShrinkage`) com $k=10$ para amortecimento de ruído em pequenas amostras de 5 jogos.
- **Novo:** Distribuição Binomial Negativa (NB2) com aproximação log-Gamma ($\ln\Gamma$) para eliminar a sobredispersão em cartões ($r=4.0$) e faltas ($r=12.0$).
- **Novo:** Ambas Marcam (BTTS) Bivariado $P(\text{BTTS}) = \sum_{i \ge 1, j \ge 1} P(i, j)$ integrado diretamente da matriz Dixon-Coles.
- **Novo:** Derivação de Handicaps Asiáticos (Draw No Bet / AH 0.0 e AH -1.5 Mandante/Visitante).
- **Novo:** Gestão de Risco e Stake via Critério de Kelly Fracionário (**Quarter-Kelly**).

### 🏛️ Arquitetura de Software & Estado (Fase 3 & 3.1)
- **Novo:** Reestruturação do código em **Clean Architecture de 5 Camadas** (`domain`, `services`, `store`, `hooks`, `components`).
- **Novo:** Gerenciamento de Estado Global Reativo com **Zustand** (`useMatchStore.js` e `useBankrollStore.js`).
- **Novo:** Padrão Repository para o Supabase (`MatchRepository.js`) e serviço de ingestão de estatísticas com relatório de erro (`statsHubParser.js`).
- **Novo:** Code-Splitting das rotas via `React.lazy()` e `<Suspense>`, reduzindo o bundle principal para **$468.04\text{ kB}$**.

### 🎨 UX/UI & Design System (Fase 4 & 4.1)
- **Novo:** Design System **Dark Glassmorphism** (Fundo `#090d16`, cards `#131b2e` com `backdrop-blur-md`).
- **Novo:** **Hero Decision Card ("Pick Principal do Modelo")** que responde em menos de 1 segundo ("1-Second Glance Test").
- **Novo:** Widget de Gestão de Banca em Reais (**`BankrollWidget.jsx`**) no Header para ajuste dinâmico da banca total (ex: R$ 5.000,00) e fração Kelly.
- **Novo:** Tipografia tabular (`tabular-nums`) para perfeito alinhamento visual de porcentagens e Odds.

### 🧪 Calibração & Homologação (Fase 6 & 7)
- **Novo:** Suíte de testes automatizada em [`src/lib/calibrationSuite.test.js`](file:///c:/appo/src/lib/calibrationSuite.test.js).
- **Validação:** **19/19 testes unitários e de calibração aprovados no Vitest** (214ms).
- **Validação:** **0 erros no build de produção Vite** (3.99s).

---

## [1.0.0] - Versão Legada (V1)
- Implementação inicial baseada em Poisson Univariada.
- Componentes monolíticos em React com `useState` espalhado.
- Ausência de EV+ Real e Gestão de Banca.
