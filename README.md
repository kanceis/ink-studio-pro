# INK Studio Pro 🎨🖋️

Sistema de Gestão Completo para Estúdios de Tatuagem, Body Piercing e Artistas Independentes.

Desenvolvido com **React 19**, **TypeScript**, **Tailwind CSS**, **Vite** e suporte para Notificações PWA / Web Push.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18.x, 20.x ou superior recomendada)
- Gestor de pacotes `npm`, `pnpm` ou `bun`

### 1. Instalar as dependências
Abre a consola ou terminal na pasta raiz do projeto descompactado e executa:

```bash
npm install
```

### 2. Iniciar o servidor de desenvolvimento
Executa o comando:

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000` (ou na porta indicada no terminal). Abre o teu browser nessa morada!

### 3. Compilar para Produção
Para gerar a versão otimizada pronta para colocar em qualquer alojamento estático (Vercel, Netlify, Firebase Hosting, Cloudflare Pages, etc.):

```bash
npm run build
```

Os ficheiros finais serão gerados na pasta `dist/`.

---

## 📂 Estrutura do Projeto

```text
├── index.html                    # Ponto de entrada HTML e meta tags PWA
├── package.json                  # Dependências e scripts de execução
├── tsconfig.json                 # Configurações TypeScript
├── vite.config.ts                # Configurações do Vite e Tailwind CSS
├── public/                       # Ficheiros estáticos
└── src/
    ├── components/               # Componentes UI (Calendário, Clientes, Consentimento, etc.)
    │   ├── Header.tsx            # Barra de navegação e atalhos
    │   ├── CalendarView.tsx      # Agenda interativa de marcações
    │   ├── AppointmentsList.tsx  # Lista e filtros de sessões
    │   ├── ClientsView.tsx       # Gestão e ficha de clientes (CRM)
    │   ├── InventoryView.tsx     # Controlo de stock e tintas
    │   ├── NotificationCenter.tsx# Central de notificações e alertas 24h
    │   ├── ShareProjectModal.tsx # Modal de partilha e download do código
    │   └── ...
    ├── context/                  # Estado global (StudioContext)
    ├── data/                     # Dados iniciais e estruturas de base
    ├── types/                    # Definições de tipos TypeScript
    ├── App.tsx                   # Componente raiz da aplicação
    └── main.tsx                  # Ponto de arranque React
```

---

## ✨ Funcionalidades Incluídas
- 📅 **Agenda e Calendário Interativo:** Marcação de sessões de tatuagem e piercing com cálculo de duração e sinal/depósito.
- 🔔 **Central de Notificações Inteligente:** Alertas de confirmação imediatos e lembretes com antecedência de 24 horas antes da sessão.
- 👥 **Gestão de Clientes (CRM):** Histórico de tatuagens realizadas, alergias, notas médicas e contactos.
- 📝 **Termos de Responsabilidade e Consentimento:** Assinatura digital no ecrã (iPad/tablet/smartphone) e termos de consentimento informado.
- 📦 **Controlo de Stock e Material:** Monitorização de agulhas, tintas, anestésicos, luvas com alertas de stock baixo.
- 💰 **Relatórios Financeiros:** Faturação, sinais recebidos, estimativas e estatísticas de rendimento por artista.
- 📱 **100% Responsivo:** Otimizado para telemóveis, tablets (iPad) e computadores desktop.
