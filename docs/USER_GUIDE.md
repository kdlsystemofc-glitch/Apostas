# SPORTS PREDICTOR V2 — GUIA PRÁTICO DO USUÁRIO APOSTADOR

> **GUIA DO USUÁRIO:** Como utilizar o sistema **Sports Predictor V2** para analisar partidas, identificar apostas de valor esperado positivo (EV+) e gerenciar a sua banca em dinheiro real (R$).

---

## 1. PASSO A PASSO PARA ANALISAR UMA PARTIDA

### Passo 1: Copiar os Dados no StatsHub
1. Acesse a partida desejada na sua plataforma de estatísticas (StatsHub / FlashScore / Sofascore).
2. Selecione e copie toda a tabela de estatísticas médias dos times (Mandante e Visitante).

### Passo 2: Colar no Sports Predictor V2
1. Na tela principal (**Dashboard / Nova Análise**), cole o texto bruto no campo de entrada **"Cole o Texto do StatsHub"**.
2. Clique no botão **"Analisar Partida (Engine V2)"**.
3. O sistema reconhecerá automaticamente as 29+ estatísticas coladas.

---

## 2. COMO INTERPRETAR O HERO DECISION CARD (1-SECOND GLANCE)

No topo da tela de resultado, o card principal apresenta em **menos de 1 segundo** a aposta de maior valor:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 PICK PRINCIPAL DO MODELO                             [ 64.5% Confiança ] │
├─────────────────────────────────────────────────────────────────────────────┤
│   VITÓRIA FLAMENGO                                                          │
│   Odd Justa: 1.55  |  🔥 EV+ +7.2% Real  |  Stake Sugerida: R$ 150,00      │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Pick Principal (1X2):** A aposta estrita recomendada pelo modelo (Vitória Mandante, Empate ou Vitória Visitante). Nenhuma aposta de chance dupla (1X, X2, 12).
- **Odd Justa (Fair Odd):** O valor mínimo teórico ($1 / \text{Probabilidade}$). Se a casa oferecer uma Odd superior a esta, a aposta tem Valor Esperado Positivo (EV+)!
- **Stake Sugerida em Reais (R$):** A quantia exata em dinheiro recomendada para apostar, calculada via Critério de Quarter-Kelly a partir da sua banca configurada.

---

## 3. CONFIGURANDO A SUA BANCA DE APOSTAS (BANKROLL WIDGET)

No menu superior (Header), você encontrará o botão de **Banca**:

1. Clique no botão **`Banca: R$ 1.000,00`**.
2. Digite a sua Banca Total atual em Reais (ex: `R$ 5.000,00`).
3. Escolha o nível de risco:
   - **Quarter-Kelly (25% - Recomendado):** Gestão conservadora e altamente segura contra bad runs.
   - **Half-Kelly (50%):** Gestão moderada.
4. Clique em **"Salvar Configurações"**. O sistema recalculará instantaneamente as apostas em Reais em todos os cards!

---

## 4. DIGITANDO A ODD DA CASA E OBTENDO O EV+ REAL

Em qualquer mercado (Gols, Escanteios, Cartões, Faltas), existe o campo **"Odd da Casa (Bet365 / Pinnacle)"**:

1. Digite a Odd atual oferecida pela casa de apostas (ex: `2.10`).
2. Se o indicador ficar **Verde (`🔥 EV+ +X.X%`)**, a aposta possui valor de longo prazo!
3. O card mostrará a porcentagem e o valor em Reais a ser apostado.
