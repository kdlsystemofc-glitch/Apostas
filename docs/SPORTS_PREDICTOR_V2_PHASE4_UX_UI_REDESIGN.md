# SPORTS PREDICTOR V2 — FASE 4: UX/UI REDESIGN
## DOCUMENTAÇÃO TÉCNICA E ESPECIFICAÇÃO DE EXPERIÊNCIA E DESIGN SYSTEM

---

### EQUIPE DE DESIGN E PESQUISA V2:
- **UX Researcher**
- **Senior Product Designer**
- **UI Designer**

---

> **DIRETRIZ DA FASE 4:** NENHUM CÓDIGO-FONTE SERÁ ALTERADO NESTA ETAPA. Este documento é a especificação completa de UX/UI para a versão 2.0 do **Sports Predictor**, definindo o Design System, a hierarquia visual, o teste do olhar de 1 segundo ("1-Second Glance Test"), os componentes modulares, a arquitetura de informação e a conformidade com as diretrizes de acessibilidade WCAG 2.1 AA.

---

## 1. AVALIAÇÃO HEURÍSTICA E DIAGNÓSTICO DE UX/UI

### 1.1 As 4 Questões Fundamentais de Experiência

1. **"O usuário entende isso?"**
   - *Problema V1:* Exibição de estatísticas e probabilidades brutas em tabelas densas gerava sobrecarga cognitiva.
   - *Solução V2:* Transformar os dados brutos em **Sinais Decisórios Visuais** (FORTE OVER, OVER, NEUTRO, UNDER) com código de cores intuitivo e explicações contextuais.

2. **"O usuário consegue tomar uma decisão rapidamente?"**
   - *Problema V1:* O usuário precisava olhar múltiplos cards para entender qual era a melhor aposta da partida.
   - *Solução V2:* Criar o **Hero Decision Card ("Pick Principal do Modelo")** no topo da tela, onde em **menos de 1 segundo** o usuário visualiza:
     - 🎯 **Aposta Recomendada** (ex: Vitória Mandante)
     - 📈 **Probabilidade / Confiança** (ex: 64.5%)
     - 💎 **Odd Justa** (ex: 1.55)
     - 🔥 **Expected Value Real (EV+)** (ex: +7.2%)
     - 💰 **Stake Sugerida em Reais (R$)** via Quarter-Kelly (ex: R$ 150,00).

3. **"Como é a experiência em dispositivos móveis?"**
   - *Problema V1:* Tabelas cortadas lateralmente e alvos de toque pequenos em telas de smartphone.
   - *Solução V2:* Touch targets mínimos de $44 \times 44\text{px}$, layout responsivo *mobile-first* com grid flexível e colapso de tabelas em cards expansíveis.

4. **"O software transmite autoridade e sofisticação profissional?"**
   - *Problema V1:* Cores genéricas e contraste fraco em modo escuro.
   - *Solução V2:* Design System inspirado nos terminais quantitativos de alta frequência (Bloomberg / TradingView / Pinnacle Quant UI), com estética *Dark Glassmorphism*, tipografia tabular e acabamento de alto padrão.

---

## 2. DESIGN SYSTEM V2 (TOKENS VISUAIS & TIPOGRAFIA)

---

### 2.1 Paleta de Cores (Dark Glassmorphism System)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PALETA DE CORES V2 (DARK MODE PREMIUM)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Canvas / Fundo Geral:       #090d16 (Slate 950 Deep)                        │
│ Card Surface:               #131b2e (Slate 900 Glass - Backdrop Blur 12px)  │
│ Borda de Cards:             #1e293b (Slate 800 Border)                      │
│                                                                             │
│ CORES DE SINAL DECISÓRIO (STATUS):                                         │
│ • FORTE OVER / EV+ POSITIVO:#10b981 (Emerald 500) com Glow #059669          │
│ • OVER / ALERTA MODERADO:   #f59e0b (Amber 500)                             │
│ • NEUTRO / FORA DE VALOR:   #64748b (Slate 500)                             │
│ • FORTE UNDER / EV NEGATIVO:#ef4444 (Red 500)                               │
│                                                                             │
│ TIPOGRAFIA:                                                                 │
│ • Texto Primário:           #f8fafc (Slate 50 Bright White - 100% Opacidade)│
│ • Texto Secundário:         #94a3b8 (Slate 400 Muted - Contraste 5.2:1 AA)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Tipografia e Números Tabulares

- **Fonte Primária para Títulos & Placares:** `Outfit` (Bold / ExtraBold / Black) — Moderna, geométrica e impactante.
- **Fonte para Interface e Textos:** `Inter` (Regular / Medium / SemiBold) — Excelente legibilidade em telas pequenas.
- **Números Tabulares:** Uso obrigatório da classe CSS `tabular-nums` em todas as porcentagens, odds e valores em Reais para evitar sobressaltos e manter o alinhamento perfeito de colunas.

---

## 3. ARQUITETURA DE INFORMAÇÃO E FLUXO DE NAVEGAÇÃO (IA)

### Estrutura da Header & Navegação Principal:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚽ SPORTS PREDICTOR V2   [ 🏠 Dashboard ] [ ⚡ Picks ] [ 📊 Calibração ]      │
│                          ┌────────────────────────────────────────────────┐ │
│                          │ 💼 Banca Total: R$ 5.000,00 (Quarter-Kelly)   │ │
│                          └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ESPECIFICAÇÃO DAS TELAS E COMPONENTES CHAVE

---

### 4.1 Mockup ASCII do Hero Decision Card ("Pick Principal do Modelo")

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 PICK PRINCIPAL DO MODELO                             [ 64.5% Confiança ] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   VITÓRIA ARGENTINA                                                         │
│                                                                             │
│   ┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ │
│   │ Odd Justa: 1.55        │  │ 🔥 EV+ +7.2% Real   │  │ Stake: R$ 150,00 │ │
│   └────────────────────────┘  └──────────────────────┘  └──────────────────┘ │
│                                                                             │
│   [Comparar Odd da Casa: 1.72 ] ➔ Aposta de Valor Esperado Positivo!         │
│                                                                             │
│   ── Placares Prováveis ──                                                  │
│   [ 2×0 (14.2%) ]  [ 1×0 (12.8%) ]  [ 2×1 (11.5%) ]  [ 3×0 (8.4%) ]           │
│                                                                             │
│   ── Handicaps Derivados ──                                                 │
│   • Draw No Bet (DNB): 82.4% (Odd Justa: 1.21)                              │
│   • Handicap -1.5 Mandante: 42.1% (Odd Justa: 2.38)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Componente `MarketBlock.jsx` (Card de Mercado Comercial)

- **Banner de Destaque:** Exibe a **Linha Comercial Recomendada** da Bet365 com badge de sinal luminoso (`FORTE OVER`, `OVER`).
- **Calculador em Tempo Real:** Campo de input de Odd da Casa que calcula instantaneamente o EV% e exibe o valor da Stake sugerida em Reais (R$) baseada no store `useBankrollStore`.
- **Tabela Comercial:** Lista de linhas Over/Under comercializáveis com probabilidades e Odds Justas.

---

### 4.3 Widget de Gestão de Banca (`BankrollWidget.jsx`)

- Permite ao usuário ajustar a sua Banca Total em Reais (ex: `R$ 1.000,00` a `R$ 50.000,00`) e alternar entre **Quarter Kelly (25%)** ou **Half Kelly (50%)**.
- Sincroniza instantaneamente o valor recomendado em Reais em todas as páginas da aplicação.

---

## 5. REQUISITOS DE ACESSIBILIDADE E USABILIDADE (WCAG 2.1 AA)

1. **Razão de Contraste:** Todos os textos principais e secundários possuem razão de contraste $\ge 4.5:1$ sobre os fundos escuros `#090d16` e `#131b2e`.
2. **Navegação por Teclado e Foco Visual:** Alvos focáveis (`input`, `button`, `a`) apresentam anel de foco destacado `ring-2 ring-emerald-500`.
3. **Leitores de Tela (Screen Readers):** Todos os badges de sinal e porcentagens contêm atributos `aria-label` descritivos (ex: `aria-label="Sinal Forte Over com 76.5 por cento de probabilidade"`).
4. **Touch Targets em Mobile:** Tamanho mínimo de botão/input em dispositivos móveis de $44 \times 44\text{px}$.

---

## 6. PLANO DE TRANSIÇÃO DE UX/UI (FASE 4.1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PLANO DE EXECUÇÃO DA IMPLEMENTAÇÃO DE UX/UI V2                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Criação do BankrollWidget no Header (Gestão R$).                    │
│ Step 2: Redesenho visual do Hero Decision Card em MatchResultBlock.         │
│ Step 3: Atualização do componente MarketBlock com iluminação de sinal.      │
│ Step 4: Ajustes de tipografia tabular e tokens de cor no index.css.         │
│ Step 5: Validação de acessibilidade WCAG AA e testes de build com Vitest.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---
Documentação técnica de UX/UI Redesign V2 concluída pela equipe de design. Nenhuma linha de código foi alterada nesta fase. Especificação 100% pronta para a implementação visual na Fase 4.1.
