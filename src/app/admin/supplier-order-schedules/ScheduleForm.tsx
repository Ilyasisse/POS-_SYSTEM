import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Option = { id: string; name: string; phone: string | null };
type Defaults = {
  id?: string;
  name: string;
  supplierId: string;
  timeZone: string;
  firstInviteAt: string;
  firstSupplierSendAt: string;
  reminderIntervalMinutes: number;
  recurrenceUnit: string;
  recurrenceInterval: number;
  endAt: string;
  deliveryLeadDays: number;
  employeeIds: string[];
};

export default function ScheduleForm({
  action,
  suppliers,
  employees,
  defaults,
}: {
  action: (formData: FormData) => Promise<void>;
  suppliers: Option[];
  employees: Option[];
  defaults: Defaults;
}) {
  return (
    <form action={action} className="space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Card className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="schedule-name">Schedule name</Label>
          <Input id="schedule-name" name="name" defaultValue={defaults.name} maxLength={120} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-supplier">Supplier</Label>
          <NativeSelect id="schedule-supplier" name="supplierId" defaultValue={defaults.supplierId} required>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}{supplier.phone ? ` (${supplier.phone})` : " (phone missing)"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-time-zone">Timezone</Label>
          <Input id="schedule-time-zone" name="timeZone" defaultValue={defaults.timeZone} required />
          <p className="text-xs text-muted-foreground">Use an IANA timezone such as Africa/Nairobi.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="delivery-lead">Expected delivery lead days</Label>
          <Input id="delivery-lead" name="deliveryLeadDays" type="number" min="0" max="365" defaultValue={defaults.deliveryLeadDays} required />
        </div>
      </Card>

      <Card className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="first-invite">First employee invitation</Label>
          <Input id="first-invite" name="firstInviteAt" type="datetime-local" defaultValue={defaults.firstInviteAt} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="supplier-send">Supplier send time / response deadline</Label>
          <Input id="supplier-send" name="firstSupplierSendAt" type="datetime-local" defaultValue={defaults.firstSupplierSendAt} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reminder-interval">Reminder interval (minutes)</Label>
          <Input id="reminder-interval" name="reminderIntervalMinutes" type="number" min="5" max="10080" defaultValue={defaults.reminderIntervalMinutes} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end-at">Optional recurrence end</Label>
          <Input id="end-at" name="endAt" type="datetime-local" defaultValue={defaults.endAt} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recurrence-unit">Repeat</Label>
          <NativeSelect id="recurrence-unit" name="recurrenceUnit" defaultValue={defaults.recurrenceUnit}>
            <option value="">One time</option>
            <option value="DAY">Every N days</option>
            <option value="WEEK">Every N weeks</option>
            <option value="MONTH">Every N months</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recurrence-interval">Repeat every N units</Label>
          <Input id="recurrence-interval" name="recurrenceInterval" type="number" min="1" max="365" defaultValue={defaults.recurrenceInterval} required />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Employees</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each selected employee receives a private link. Invalid or missing phone numbers must be fixed in Staff first.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => {
            const disabled = !employee.phone;
            return (
              <label key={employee.id} className="flex min-h-14 items-center gap-3 rounded-xl border p-3">
                <input
                  type="checkbox"
                  name="employeeId"
                  value={employee.id}
                  defaultChecked={defaults.employeeIds.includes(employee.id)}
                  disabled={disabled}
                  className="size-4"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{employee.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {employee.phone ?? "Phone missing"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{defaults.id ? "Save schedule" : "Create schedule"}</Button>
      </div>
    </form>
  );
}
