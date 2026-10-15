import { z } from "zod";
import {
  addressSnapshotSchema,
  cancelSchema,
  deliverySchema,
  moveSchema,
  readyDateSchema,
  rescheduleSchema,
  stageSchema,
  updateItemsSchema,
} from "@/domain/schemas";
import {
  advanceInvoice,
  cancelAppointment,
  clearDelivery,
  scheduleDelivery,
  setReadyDate,
  setStage,
  completeAppointment,
  confirmAppointment,
  unconfirmAppointment,
  markPaid,
  moveAppointment,
  rescheduleAppointment,
  setBillingAddress,
  setAppointmentAddress,
  setDestinationAddress,
  updateAppointmentItems,
  updateNotes,
  type Db,
  type Mutation,
} from "./appointments";
import type { Actor } from "@/db/schema";

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("unconfirm") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("mark_paid") }),
  z.object({ action: z.literal("advance_invoice") }),
  z.object({ action: z.literal("cancel") }).extend(cancelSchema.shape),
  z.object({ action: z.literal("reschedule") }).extend(rescheduleSchema.shape),
  z.object({ action: z.literal("move") }).extend(moveSchema.shape),
  z.object({ action: z.literal("set_destination"), address: addressSnapshotSchema.nullable() }),
  z.object({ action: z.literal("set_billing"), address: addressSnapshotSchema }),
  z.object({ action: z.literal("update_notes"), notes: z.string() }),
  z.object({ action: z.literal("set_address"), addressId: z.string() }),
  z.object({ action: z.literal("update_items") }).extend(updateItemsSchema.shape),
  z.object({ action: z.literal("set_stage") }).extend(stageSchema.shape),
  z.object({ action: z.literal("set_ready_date") }).extend(readyDateSchema.shape),
  z.object({ action: z.literal("schedule_delivery") }).extend(deliverySchema.shape),
  z.object({ action: z.literal("clear_delivery") }),
]);

export type AppointmentAction = z.infer<typeof actionSchema>;

export async function runAction(db: Db, actor: Actor, id: string, raw: unknown): Promise<Mutation> {
  const input = actionSchema.parse(raw);
  switch (input.action) {
    case "confirm":
      return confirmAppointment(db, actor, id);
    case "unconfirm":
      return unconfirmAppointment(db, actor, id);
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
    case "set_address":
      return setAppointmentAddress(db, actor, id, { addressId: input.addressId });
    case "update_items":
      return updateAppointmentItems(db, actor, id, input);
    case "set_stage":
      return setStage(db, actor, id, input);
    case "set_ready_date":
      return setReadyDate(db, actor, id, input);
    case "schedule_delivery":
      return scheduleDelivery(db, actor, id, input);
    case "clear_delivery":
      return clearDelivery(db, actor, id);
  }
}
