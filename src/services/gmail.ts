export interface SendEmailParams {
  to: string;
  toName: string;
  subject: string;
  htmlContent: string;
  fromName?: string;
}

export const sendGmailMessage = async (
  params: SendEmailParams,
  accessToken: string
): Promise<{ id: string; threadId: string }> => {
  const fromHeader = params.fromName ? `From: "${params.fromName}" <me>` : 'From: me';
  const toHeader = `To: "${params.toName}" <${params.to}>`;
  const subjectHeader = `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`;

  const emailLines = [
    fromHeader,
    toHeader,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    subjectHeader,
    '',
    params.htmlContent,
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedEmail,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao enviar email pelo Gmail (${response.status})`
    );
  }

  return response.json();
};
