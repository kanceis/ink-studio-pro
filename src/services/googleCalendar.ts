import { Appointment } from '../types';

export interface GCalEventResponse {
  id: string;
  htmlLink: string;
  summary: string;
}

export const createGoogleCalendarEvent = async (
  appointment: Appointment,
  accessToken: string
): Promise<GCalEventResponse> => {
  const startDateTime = `${appointment.date}T${appointment.startTime}:00`;
  const endDateTime = `${appointment.date}T${appointment.endTime}:00`;

  const eventPayload = {
    summary: `Tatuagem: ${appointment.clientName} [${appointment.style || 'Sessão'}]`,
    description: [
      `🎨 Artista: ${appointment.artistName}`,
      `👤 Cliente: ${appointment.clientName}`,
      `📞 Contacto: ${appointment.clientPhone}`,
      `📧 Email: ${appointment.clientEmail}`,
      `📍 Local anatómico: ${appointment.placement}`,
      `💶 Valor: €${appointment.price.toFixed(2)} (Sinal: €${appointment.deposit.toFixed(2)})`,
      appointment.notes ? `📝 Notas: ${appointment.notes}` : '',
      '\nGerido por InkStudio Pro',
    ]
      .filter(Boolean)
      .join('\n'),
    start: {
      dateTime: new Date(startDateTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: new Date(endDateTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: [
      appointment.clientEmail ? { email: appointment.clientEmail, displayName: appointment.clientName } : null,
    ].filter(Boolean),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 }, // 24h before
        { method: 'popup', minutes: 120 },  // 2h before
      ],
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao sincronizar com Google Agenda (${response.status})`
    );
  }

  return response.json();
};

export const updateGoogleCalendarEvent = async (
  eventId: string,
  appointment: Appointment,
  accessToken: string
): Promise<GCalEventResponse> => {
  const startDateTime = `${appointment.date}T${appointment.startTime}:00`;
  const endDateTime = `${appointment.date}T${appointment.endTime}:00`;

  const eventPayload = {
    summary: `Tatuagem: ${appointment.clientName} [${appointment.style || 'Sessão'}]`,
    description: [
      `🎨 Artista: ${appointment.artistName}`,
      `👤 Cliente: ${appointment.clientName}`,
      `📞 Contacto: ${appointment.clientPhone}`,
      `📧 Email: ${appointment.clientEmail}`,
      `📍 Local: ${appointment.placement}`,
      `💶 Valor: €${appointment.price.toFixed(2)} (Sinal: €${appointment.deposit.toFixed(2)})`,
      appointment.notes ? `📝 Notas: ${appointment.notes}` : '',
      `Estado: ${appointment.status.toUpperCase()}`,
      '\nGerido por InkStudio Pro',
    ]
      .filter(Boolean)
      .join('\n'),
    start: {
      dateTime: new Date(startDateTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: new Date(endDateTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao atualizar evento na Google Agenda (${response.status})`
    );
  }

  return response.json();
};

export const deleteGoogleCalendarEvent = async (
  eventId: string,
  accessToken: string
): Promise<void> => {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao remover da Google Agenda (${response.status})`
    );
  }
};
