// What a "send this to the customer" action reports back to the screen. Plain
// types only, so the server actions and the client components share one shape
// without the client importing anything that touches the database.

export type Channel = "whatsapp" | "email";
export const CHANNELS: readonly Channel[] = ["whatsapp", "email"];

export type ChannelOutcome = {
  channel: Channel;
  /**
   * sent      the system delivered it.
   * prepared  it could not, and `href` opens it ready to send by hand.
   * skipped   nothing on file to send to.
   */
  state: "sent" | "prepared" | "skipped";
  /** Hebrew, for the agent. */
  detail: string;
  /** The number or address it went (or would go) to, for the agent's own screen. */
  to?: string;
  href?: string;
};

export type Registration =
  | { ok: true; leadId: string }
  | { ok: false; error: string; skipped?: boolean };

export type SendOutcome =
  | {
      ok: true;
      /** The case (the row the customer's answers will land on). */
      id: string;
      /** The link the customer opens. */
      link: string;
      /** An earlier unanswered send to the same customer was picked up, not duplicated. */
      reused?: boolean;
      /** Whether the customer is on record in Mslahtk. Only set when this send opened a case. */
      registration?: Registration;
      outcomes: ChannelOutcome[];
    }
  | { ok: false; error: string };
