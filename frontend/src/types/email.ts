export type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
export interface Email { id: string; sender: string; recipient: string; subject: string; body: string; scheduledAt: string; sentAt?: string | null; status: EmailStatus; errorMessage?: string | null; }
export interface User { id: string; name: string; email: string; avatar?: string | null; }
