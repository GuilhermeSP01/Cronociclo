# Cronociclo ⏱️

Aplicativo mobile e PWA para marcação de tempo em ciclos de **Atividade** e **Descanso**, construído com **HTML5, CSS3, JavaScript Vanilla, Vite e Capacitor**.

## Funcionalidades

- **Seletores em Roleta Giratória (Drum Picker)**:
  - Tempo de Atividade (`MM:SS`, de `00:01` a `99:59`)
  - Tempo de Descanso (`MM:SS`, de `00:00` a `99:59` — permite `00:00` para ciclos contínuos)
  - Quantidade de Sessões (`1` a `99`)
- **Persistência Automática**: Lembra automaticamente os últimos valores configurados e o estado de som/vibração no dispositivo (`localStorage`).
- **Contagem Regressiva de Preparação**: 5 segundos fixos ("Prepare-se") sempre antes de iniciar a 1ª sessão.
- **Finalização Inteligente**: Encerra o ciclo imediatamente após a última sessão de atividade (sem descanso desnecessário no final).
- **Relógio Real (Zero Drift)**: Cálculo baseado em timestamps (`Date.now()`) para não atrasar caso o app vá para segundo plano.
- **Alertas Sonoros e Hápticos**:
  - Bipes curtos nos últimos 3 segundos (`3, 2, 1`) gerados via `Web Audio API`.
  - Acordes e vibrações distintos para início de Atividade, Descanso e Conclusão do Ciclo (`@capacitor/haptics` + fallback web).
- **Tela Acesa e Notificações**: Mantém a tela ligada (`@capacitor-community/keep-awake` / `Screen Wake Lock API`) e dispara notificações locais em segundo plano (`@capacitor/local-notifications`).

## Como executar no ambiente de desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (Vite)
npm run dev
```

## Build para Produção (PWA)

```bash
npm run build
npm run preview
```

## Empacotar para Android / iOS com Capacitor

```bash
# 1. Gerar o build web
npm run build

# 2. Adicionar a plataforma desejada (primeira vez)
npx cap add android
# ou: npx cap add ios

# 3. Sincronizar código web e plugins nativos
npm run cap:sync

# 4. Abrir no Android Studio / Xcode
npx cap open android
```
