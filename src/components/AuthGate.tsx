import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2, LogOut, ShieldAlert, Database, Upload, Sparkles } from 'lucide-react';
import { auth, signInToStudio, logout } from '../services/firebaseAuth';
import {
  checkStudioAccess,
  isStudioEmpty,
  readLegacyLocalData,
  seedStudio,
  StudioSnapshot,
} from '../services/studioStore';
import { STUDIO_ID } from '../services/firebaseApp';
import {
  defaultSettings,
  defaultArtists,
  defaultClients,
  defaultAppointments,
  defaultInventory,
  defaultNotificationLogs,
} from '../context/initialData';
import { OfficialGoogleButton } from './OfficialGoogleButton';

type GateState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'checking'; user: User }
  | { kind: 'denied'; user: User }
  | { kind: 'missing'; user: User }
  | { kind: 'setup'; user: User }
  | { kind: 'ready'; user: User }
  | { kind: 'error'; user: User | null; message: string };

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-zinc-500">InkStudio Pro</p>
      </div>
      {children}
    </div>
  </div>
);

const SignOutLink: React.FC<{ user: User }> = ({ user }) => (
  <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
    <span className="truncate">Sessão: {user.email}</span>
    <button onClick={() => logout()} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white cursor-pointer">
      <LogOut className="w-3 h-3" /> Sair
    </button>
  </div>
);

/**
 * Only signed-in members of the studio get past this screen.
 * The real protection is in firestore.rules; this component just explains what is going on.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    const theme = localStorage.getItem('inkstudio_theme') || 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ kind: 'signedOut' });
        return;
      }
      setState({ kind: 'checking', user });
      try {
        const access = await checkStudioAccess();
        if (access === 'denied') return setState({ kind: 'denied', user });
        if (access === 'missing') return setState({ kind: 'missing', user });
        const empty = await isStudioEmpty();
        setState({ kind: empty ? 'setup' : 'ready', user });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', user, message });
      }
    });
  }, []);

  const handleSignIn = async () => {
    setSignInError(null);
    setBusy(true);
    try {
      await signInToStudio();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setSignInError('Não foi possível iniciar sessão. Tenta de novo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const runSeed = async (user: User, data: StudioSnapshot) => {
    setBusy(true);
    try {
      await seedStudio(data);
      setState({ kind: 'ready', user });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', user, message });
    } finally {
      setBusy(false);
    }
  };

  switch (state.kind) {
    case 'loading':
    case 'checking':
      return (
        <Shell>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" /> A carregar o estúdio…
          </div>
        </Shell>
      );

    case 'signedOut':
      return (
        <Shell>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Entrar no estúdio</h1>
            <p className="text-sm text-zinc-500">
              Usa a conta Google autorizada pelo estúdio. Os dados ficam guardados na nuvem e aparecem em todos os teus dispositivos.
            </p>
          </div>
          <OfficialGoogleButton onClick={handleSignIn} isLoading={busy} label="Entrar com Google" />
          {signInError && <p className="text-xs text-red-500">{signInError}</p>}
        </Shell>
      );

    case 'denied':
      return (
        <Shell>
          <div className="flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h1 className="text-lg font-bold">Sem acesso a este estúdio</h1>
              <p className="text-sm text-zinc-500">
                A conta <strong>{state.user.email}</strong> não tem acesso. Ou não está na lista de membros, ou o estúdio ainda não foi configurado (ver README). Pede ao responsável do estúdio para a adicionar, ou entra com outra conta.
              </p>
            </div>
          </div>
          <SignOutLink user={state.user} />
        </Shell>
      );

    case 'missing':
      return (
        <Shell>
          <div className="flex gap-3">
            <Database className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h1 className="text-lg font-bold">Estúdio ainda não configurado</h1>
              <p className="text-sm text-zinc-500">
                Falta criar o documento <code className="text-xs">studios/{STUDIO_ID}</code> no Firestore com a lista de membros. Os passos estão no README.
              </p>
            </div>
          </div>
          <SignOutLink user={state.user} />
        </Shell>
      );

    case 'setup': {
      const legacy = readLegacyLocalData();
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Primeira utilização</h1>
            <p className="text-sm text-zinc-500">A base de dados do estúdio está vazia. Como queres começar?</p>
          </div>
          <div className="space-y-2">
            {legacy && (
              <button
                disabled={busy}
                onClick={() =>
                  runSeed(state.user, {
                    settings: { ...defaultSettings, ...(legacy.settings ?? {}) },
                    artists: legacy.artists ?? [],
                    clients: legacy.clients ?? [],
                    appointments: legacy.appointments ?? [],
                    inventory: legacy.inventory ?? [],
                    notifications: legacy.notifications ?? [],
                  })
                }
                className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">Importar os dados deste dispositivo</span>
                  <span className="block text-xs text-zinc-500">
                    Traz o stock, clientes e marcações guardados neste browser pela versão anterior
                    ({legacy.inventory?.length ?? 0} artigos, {legacy.clients?.length ?? 0} clientes).
                  </span>
                </span>
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                runSeed(state.user, {
                  settings: defaultSettings,
                  artists: [],
                  clients: [],
                  appointments: [],
                  inventory: [],
                  notifications: [],
                })
              }
              className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer disabled:opacity-50"
            >
              <Database className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">Começar do zero</span>
                <span className="block text-xs text-zinc-500">Estúdio vazio, pronto para os teus dados reais.</span>
              </span>
            </button>
            <button
              disabled={busy}
              onClick={() =>
                runSeed(state.user, {
                  settings: defaultSettings,
                  artists: defaultArtists,
                  clients: defaultClients,
                  appointments: defaultAppointments,
                  inventory: defaultInventory,
                  notifications: defaultNotificationLogs,
                })
              }
              className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">Carregar dados de exemplo</span>
                <span className="block text-xs text-zinc-500">Clientes e stock fictícios, só para experimentar.</span>
              </span>
            </button>
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" /> A preparar o estúdio…
            </p>
          )}
          <SignOutLink user={state.user} />
        </Shell>
      );
    }

    case 'error':
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Não foi possível ligar à base de dados</h1>
            <p className="text-sm text-zinc-500 break-words">{state.message}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-sm font-semibold cursor-pointer"
          >
            Tentar de novo
          </button>
          {state.user && <SignOutLink user={state.user} />}
        </Shell>
      );

    case 'ready':
      return <>{children}</>;
  }
};
