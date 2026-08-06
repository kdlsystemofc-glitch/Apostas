# ⚽ SPORTS PREDICTOR V2 — MOTOR AUTÔNOMO DE PREVISÃO DE MERCADOS ESPORTIVOS

> **SPORTS PREDICTOR V2.0 (RELEASE OFICIAL)** — Sistema de Inteligência Estatística e Modelagem Probabilística Quantitativa para Previsão de Mercados Esportivos de Alta Precisão.

[![Vitest Unit Tests](https://img.shields.io/badge/Vitest-19%2F19%20Passed-emerald?style=flat-square&logo=vitest)](file:///c:/appo/src/lib/predictionEngine.test.js)
[![Clean Architecture](https://img.shields.io/badge/Architecture-Clean%205--Layer-blue?style=flat-square)](file:///c:/appo/docs/SPORTS_PREDICTOR_V2_PHASE3_ARCHITECTURE_PLAN.md)
[![Vite Production Build](https://img.shields.io/badge/Build-Passing%200%20Errors-success?style=flat-square)](file:///c:/appo/package.json)
[![Design System](https://img.shields.io/badge/UI-Dark%20Glassmorphism-9333ea?style=flat-square)](file:///c:/appo/docs/SPORTS_PREDICTOR_V2_PHASE4_UX_UI_REDESIGN.md)

---

## 🌟 O QUE É O SPORTS PREDICTOR V2?

O **Sports Predictor V2** é uma plataforma web quantitativa avançada desenvolvida para apostadores profissionais, cientistas de dados e analistas de futebol. O sistema converte dados brutos de desempenho colados diretamente do **StatsHub** em **Probabilidades Calibradas**, **Odds Justas ($1/P$)**, **Expected Value Real (EV+)** e **Sugestões de Stake em Reais (R$)** via Critério de Kelly Fracionário (**Quarter-Kelly**).

---

## 📐 MODELAGEM MATEMÁTICA E ESTATÍSTICA V2

O motor estatístico local em JavaScript puro ([`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js)) é 100% autônomo e opera sem nenhuma dependência de plataformas externas (sem footystats):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MOTOR ESTATÍSTICO V2.0 (ARQUITETURA DE MODELAGEM)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. BAYESIAN SHRINKAGE LAYER:                                               │
│    λ_bayes = (n / (n + 10)) * λ_obs + (1 - (n / (n + 10))) * μ_liga         │
│    Amortece o ruído de amostras curtas (5 jogos) em direção à liga.         │
│                                                                             │
│ 2. DIXON-COLES BIVARIATE SCORE MATRIX (8x8):                                │
│    Corrige a subestimativa de placares baixos (0x0, 1x0, 0x1, 1x1) com ρ=-0.13.│
│                                                                             │
│ 3. BINOMIAL NEGATIVA (NB2) PARA CARTÕES & FALTAS:                           │
│    Resolve a sobredispersão (σ² >> μ) para cartões (r=4.0) e faltas (r=12.0).│
│                                                                             │
│ 4. CRITÉRIO DE KELLY FRACIONÁRIO (QUARTER-KELLY EN R$):                     │
│    f* = max(0, 0.25 * ((P * Odd_casa - 1) / (Odd_casa - 1)))               │
│    Calcula a stake em % e a quantia exata em dinheiro real (R$).            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ ESTRUTURA ARQUITETURAL (CLEAN ARCHITECTURE 5-LAYERS)

```
src/
├── domain/                      # Regras de Negócio Puras & Motor Probabilístico (predictionEngine.js)
├── services/                    # Repositórios (MatchRepository.js) e Parsers (statsHubParser.js)
├── store/                       # Estado Reativo Zustand (useMatchStore.js, useBankrollStore.js)
├── hooks/                       # Hooks Customizados Desacoplados (useAnalyzeMatch.js)
├── components/                  # Design System (BankrollWidget.jsx, MatchResultBlock.jsx, MarketBlock.jsx)
└── pages/                       # Views com Lazy-Loading via React.lazy() (< 469 kB)
```

---

## 🚦 GUIA DE INSTALAÇÃO E EXECUÇÃO LOCAL

### Pré-requisitos
- **Node.js:** `v18.0.0` ou superior
- **npm:** `v9.0.0` ou superior

### Passos de Instalação:

```bash
# 1. Clonar o repositório oficial
git clone https://github.com/kdlsystemofc-glitch/Apostas.git
cd Apostas

# 2. Instalar dependências
npm install

# 3. Executar em ambiente de desenvolvimento
npm run dev

# 4. Executar a suíte de testes unitários e de calibração estatística
npx vitest run

# 5. Compilar o bundle de produção
npm run build
```

---

## 📚 DOCUMENTAÇÃO COMPLETA DO PROJETO

- 📄 **[Guia Mestre de Handover para IA](file:///c:/appo/docs/AGENT_HANDOVER_GUIDE.md)** (`docs/AGENT_HANDOVER_GUIDE.md`)
- 📄 **[Relatório de Publicação Final (Fase 8)](file:///c:/appo/docs/SPORTS_PREDICTOR_V2_PHASE8_FINAL_PUBLICATION_REPORT.md)** (`docs/SPORTS_PREDICTOR_V2_PHASE8_FINAL_PUBLICATION_REPORT.md`)
- 📄 **[Changelog Oficial V1 ➔ V2](file:///c:/appo/CHANGELOG.md)** (`CHANGELOG.md`)
- 📄 **[Guia do Usuário Apostador](file:///c:/appo/docs/USER_GUIDE.md)** (`docs/USER_GUIDE.md`)
- 📄 **[Guia de Arquitetura Técnica](file:///c:/appo/docs/TECHNICAL_ARCHITECTURE_GUIDE.md)** (`docs/TECHNICAL_ARCHITECTURE_GUIDE.md`)

---

## 📜 LICENÇA

Este projeto é de propriedade exclusiva de **kdlsystemofc-glitch / Apostas**. Todos os direitos reservados.
