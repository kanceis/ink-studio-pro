/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudioProvider, useStudio } from './context/StudioContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { CalendarView } from './components/CalendarView';
import { ClientCRMView } from './components/ClientCRMView';
import { ArtistsView } from './components/ArtistsView';
import { StockView } from './components/StockView';
import { MessagingView } from './components/MessagingView';
import { AnalyticsView } from './components/AnalyticsView';
import { StudioProfileView } from './components/StudioProfileView';
import { AppointmentModal } from './components/AppointmentModal';
import { QuickAlertsModal } from './components/QuickAlertsModal';
import { SendDirectMessageModal } from './components/SendDirectMessageModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { ShareProjectModal } from './components/ShareProjectModal';
import { AuthGate } from './components/AuthGate';
import { SiteView } from './components/SiteView';
import { Appointment } from './types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const StudioAppContent: React.FC = () => {
  const { activeTab, setActiveTab, toasts, dismissToast } = useStudio();

  // Modals state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isQuickAlertsOpen, setIsQuickAlertsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [messageModalState, setMessageModalState] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
    defaultType: 'confirmation' | 'reminder_24h';
  }>({
    isOpen: false,
    appointment: null,
    defaultType: 'confirmation',
  });

  const handleOpenNewAppointment = () => {
    setEditingAppointment(null);
    setIsAppointmentModalOpen(true);
  };

  const handleSelectAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsAppointmentModalOpen(true);
  };

  const handleOpenMessageModal = (
    appointment: Appointment,
    defaultType: 'confirmation' | 'reminder_24h'
  ) => {
    setMessageModalState({
      isOpen: true,
      appointment,
      defaultType,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans transition-colors antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-950 flex flex-col">
      {/* Top Header */}
      <Header
        onOpenNewAppointment={handleOpenNewAppointment}
        onOpenQuickAlerts={() => setIsQuickAlertsOpen(true)}
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      {/* Navigation (Top bar on iPad/Desktop, Bottom bar on mobile) */}
      <Navigation />

      {/* Main Content View with padding for bottom nav on mobile */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {activeTab === 'calendar' && (
          <CalendarView
            onSelectAppointment={handleSelectAppointment}
            onNewAppointment={handleOpenNewAppointment}
            onOpenMessageModal={handleOpenMessageModal}
          />
        )}

        {activeTab === 'clients' && <ClientCRMView />}

        {activeTab === 'artists' && <ArtistsView />}

        {activeTab === 'stock' && <StockView />}

        {activeTab === 'messages' && <MessagingView />}

        {activeTab === 'analytics' && <AnalyticsView />}

        {activeTab === 'profile' && <StudioProfileView />}

        {activeTab === 'site' && <SiteView />}
      </main>

      {/* Modals */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        appointmentToEdit={editingAppointment}
      />

      <QuickAlertsModal
        isOpen={isQuickAlertsOpen}
        onClose={() => setIsQuickAlertsOpen(false)}
        onGoToStock={() => setActiveTab('stock')}
        onGoToMessages={() => setActiveTab('messages')}
      />

      <SendDirectMessageModal
        isOpen={messageModalState.isOpen}
        onClose={() =>
          setMessageModalState({ isOpen: false, appointment: null, defaultType: 'confirmation' })
        }
        appointment={messageModalState.appointment}
        defaultType={messageModalState.defaultType}
      />

      <NotificationCenterModal />
      <ShareProjectModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Floating In-App Toast Notifications (No window.alert) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-200 ${
                isSuccess
                  ? 'bg-emerald-950/90 dark:bg-emerald-950/95 border-emerald-700/60 text-emerald-100'
                  : isError
                  ? 'bg-rose-950/90 dark:bg-rose-950/95 border-rose-700/60 text-rose-100'
                  : 'bg-zinc-900/90 dark:bg-zinc-900/95 border-zinc-700/60 text-zinc-100'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
              <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
                {toast.message}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-zinc-400 hover:text-white shrink-0 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthGate>
      <StudioProvider>
        <StudioAppContent />
      </StudioProvider>
    </AuthGate>
  );
}
