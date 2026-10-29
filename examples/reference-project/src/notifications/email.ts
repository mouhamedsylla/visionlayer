export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export function send(message: EmailMessage): void {
  console.log(`sending email to ${message.to}: ${message.subject}`);
}
