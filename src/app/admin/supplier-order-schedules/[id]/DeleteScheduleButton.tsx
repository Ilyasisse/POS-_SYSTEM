"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { deleteSupplierOrderSchedule } from "../actions";

export default function DeleteScheduleButton({
  scheduleId,
  scheduleName,
}: {
  scheduleId: string;
  scheduleName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          Delete schedule
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {scheduleName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This stops future invitations, reminders, and supplier sends. Existing purchase orders,
            responses, and WhatsApp delivery history will be preserved. Messages already accepted by
            Twilio cannot be recalled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Keep schedule</AlertDialogCancel>
          <form action={deleteSupplierOrderSchedule}>
            <Input type="hidden" name="id" value={scheduleId} />
            <AlertDialogAction type="submit" variant="destructive">
              Delete schedule
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
