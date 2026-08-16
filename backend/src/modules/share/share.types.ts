export interface ShareRequestInput {
  type: "invoice" | "statement";
  id?: string;
  partyId?: string;
  to?: string;
}

export interface SharePayload {
  subject: string;
  body: string;
  mailto: string;
  whatsapp: string;
}