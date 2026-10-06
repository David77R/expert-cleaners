import { z } from "zod";
import { cancelSchema, moveSchema, rescheduleSchema, addressSnapshotSchema } from "@/domain/schemas";
import {
  advanceInvoice,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  markPaid,
  moveAppointment,
  rescheduleAppointment,
  setBillingAddress,
  setDestinationAddress,
  updateNotes,
  type Db,
  type Mutation,
} from "./appointments";
import type { Actor } from "@/db/schema";

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("mark_paid") }),
  z.object({ action: z.literal("advance_invoice") }),
  z.object({ action: z.literal("cancel") }).extend(cancelSchema.shape),
  z.object({ action: z.literal("reschedule") }).extend(rescheduleSchema.shape),
  z.object({ action: z.literal("move") }).extend(moveSchema.shape),
  z.object({ action: z.literal("set_destination"), address: addressSnapshotSchema }),
  z.object({ action: z.literal("set_billing"), address: addressSnapshotSchema }),
  z.object({ action: z.literal("update_notes"), notes: z.string() }),
]);

export type AppointmentAction = z.infer<typeof actionSchema>;

export async function runAction(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = actionSchema.parse(raw);
  switch (input.action) {
    case "confirm":
      return confirmAppointment(db, actor, id);
    case "complete":
      return completeAppointment(db, actor, id);
    case "mark_paid":
      return markPaid(db, actor, id);
    case "advance_invoice":
      return advanceInvoice(db, actor, id);
    case "cancel":
      return cancelAppointment(db, actor, id, input);
    case "reschedule":
      return rescheduleAppointment(db, actor, id, input);
    case "move":
      return moveAppointment(db, actor, id, input);
    case "set_destination":
      return setDestinationAddress(db, actor, id, input.address);
    case "set_billing":
      return setBillingAddress(db, actor, id, input.address);
    case "update_notes":
      return updateNotes(db, actor, id, input.notes);
  }
}
