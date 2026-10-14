import type { AttendanceSettings, UpdateAttendanceSettingsRequest } from '@cms/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useUpdateAttendanceSettings } from '../api';
import { ISO_WEEKDAYS, workScheduleSchema, type WorkScheduleFormValues } from '../schemas';
import { TEXT, WEEKDAY_SHORT } from '../labels';

const VALIDATION_STATUS = 400;

function toFormValues(settings: AttendanceSettings): WorkScheduleFormValues {
  const hasLunch = settings.lunchStart !== null && settings.lunchEnd !== null;
  return {
    workStart: settings.workStart,
    workEnd: settings.workEnd,
    hasLunch,
    lunchStart: settings.lunchStart ?? '',
    lunchEnd: settings.lunchEnd ?? '',
    workDays: [...settings.workDays].sort((a, b) => a - b),
    monthlyLateAllowanceMin: settings.monthlyLateAllowanceMin,
  };
}

function toRequest(values: WorkScheduleFormValues): UpdateAttendanceSettingsRequest {
  return {
    workStart: values.workStart,
    workEnd: values.workEnd,
    lunchStart: values.hasLunch ? values.lunchStart : null,
    lunchEnd: values.hasLunch ? values.lunchEnd : null,
    workDays: [...values.workDays].sort((a, b) => a - b),
    monthlyLateAllowanceMin: values.monthlyLateAllowanceMin,
  };
}

export function WorkScheduleForm({
  settings,
  canWrite,
}: {
  settings: AttendanceSettings;
  /** false = chế độ chỉ xem: mọi input disabled, ẩn nút Lưu, không gọi mutation. */
  canWrite: boolean;
}) {
  const updateSettings = useUpdateAttendanceSettings();
  const form = useForm<WorkScheduleFormValues>({
    resolver: zodResolver(workScheduleSchema),
    defaultValues: toFormValues(settings),
  });
  const hasLunch = form.watch('hasLunch');

  const onSubmit = form.handleSubmit(async (values) => {
    // Chế độ chỉ xem không được gọi mutation (chặn thật ở backend).
    if (!canWrite) return;
    try {
      await updateSettings.mutateAsync(toRequest(values));
      toast.success(TEXT.scheduleSaved);
    } catch (error) {
      // AC6: lỗi 400 lọt qua validate FE → hiển thị message backend.
      if (error instanceof ApiError && error.status === VALIDATION_STATUS) {
        form.setError('root', { type: 'server', message: error.message });
        return;
      }
      toast.error(error instanceof Error ? error.message : TEXT.genericError);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXT.scheduleTitle}</CardTitle>
        <CardDescription>{TEXT.scheduleDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeField name="workStart" label={TEXT.workStart} disabled={!canWrite} />
              <TimeField name="workEnd" label={TEXT.workEnd} disabled={!canWrite} />
            </div>

            <FormField
              name="hasLunch"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      id="has-lunch"
                      disabled={!canWrite}
                    />
                  </FormControl>
                  <FormLabel htmlFor="has-lunch" className="cursor-pointer font-normal">
                    {TEXT.lunchToggle}
                  </FormLabel>
                </FormItem>
              )}
            />

            {hasLunch && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TimeField name="lunchStart" label={TEXT.lunchStart} disabled={!canWrite} />
                <TimeField name="lunchEnd" label={TEXT.lunchEnd} disabled={!canWrite} />
              </div>
            )}

            <FormField
              control={form.control}
              name="workDays"
              render={({ field }) => {
                const selected: number[] = field.value;
                return (
                  <FormItem>
                    <FormLabel>{TEXT.workDays}</FormLabel>
                    <div className="flex flex-wrap gap-4">
                      {ISO_WEEKDAYS.map((day) => (
                        <label key={day} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={selected.includes(day)}
                            onCheckedChange={(next) => {
                              const set = new Set(selected);
                              if (next === true) set.add(day);
                              else set.delete(day);
                              field.onChange([...set].sort((a, b) => a - b));
                            }}
                            aria-label={WEEKDAY_SHORT[day]}
                            disabled={!canWrite}
                          />
                          {WEEKDAY_SHORT[day]}
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="monthlyLateAllowanceMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{TEXT.lateAllowance}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        disabled={!canWrite}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="attendance-timezone">{TEXT.timezone}</Label>
                <Input id="attendance-timezone" value={settings.timezone} readOnly disabled />
              </div>
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            {canWrite && (
              <div>
                <Button type="submit" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? TEXT.savingSchedule : TEXT.saveSchedule}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TimeField({
  name,
  label,
  disabled,
}: {
  name: 'workStart' | 'workEnd' | 'lunchStart' | 'lunchEnd';
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="time" {...field} value={field.value ?? ''} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
