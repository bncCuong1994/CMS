import type { OfficeLocation } from '@cms/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useCreateOfficeLocation, useUpdateOfficeLocation } from '../api';
import { DEFAULT_RADIUS_M, officeLocationSchema, type OfficeLocationFormValues } from '../schemas';
import { TEXT } from '../labels';

const VALIDATION_STATUS = 400;

function toFormValues(location: OfficeLocation | null): OfficeLocationFormValues {
  return {
    name: location?.name ?? '',
    latitude: location?.latitude ?? Number.NaN,
    longitude: location?.longitude ?? Number.NaN,
    radiusM: location?.radiusM ?? DEFAULT_RADIUS_M,
    isActive: location?.isActive ?? true,
  };
}

export function OfficeLocationDialog({
  location,
  open,
  onOpenChange,
}: {
  /** null = thêm mới; có giá trị = sửa điểm đó. */
  location: OfficeLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = location !== null;
  const createLocation = useCreateOfficeLocation();
  const updateLocation = useUpdateOfficeLocation(location?.id ?? '');
  const pending = createLocation.isPending || updateLocation.isPending;

  const form = useForm<OfficeLocationFormValues>({
    resolver: zodResolver(officeLocationSchema),
    defaultValues: toFormValues(location),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateLocation.mutateAsync({
          name: values.name,
          latitude: values.latitude,
          longitude: values.longitude,
          radiusM: values.radiusM,
          isActive: values.isActive,
        });
        toast.success(TEXT.locationUpdated);
      } else {
        await createLocation.mutateAsync({
          name: values.name,
          latitude: values.latitude,
          longitude: values.longitude,
          radiusM: values.radiusM,
        });
        toast.success(TEXT.locationCreated);
      }
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? TEXT.editLocation : TEXT.addLocation}</DialogTitle>
          <DialogDescription>{TEXT.locationsDescription}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <TextField name="name" label={TEXT.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField name="latitude" label={TEXT.latitude} step="any" />
              <NumberField name="longitude" label={TEXT.longitude} step="any" />
            </div>
            <NumberField name="radiusM" label={TEXT.radius} step={1} hint={TEXT.radiusHint} />

            <FormField
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      id="location-active"
                    />
                  </FormControl>
                  <FormLabel htmlFor="location-active" className="cursor-pointer font-normal">
                    {TEXT.active}
                  </FormLabel>
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {TEXT.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (isEdit ? TEXT.saving : TEXT.creating) : isEdit ? TEXT.save : TEXT.create}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({ name, label }: { name: FieldPath<OfficeLocationFormValues>; label: string }) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={typeof field.value === 'string' ? field.value : ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({
  name,
  label,
  step,
  hint,
}: {
  name: FieldPath<OfficeLocationFormValues>;
  label: string;
  step: number | 'any';
  hint?: string;
}) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              value={typeof field.value === 'number' && !Number.isNaN(field.value) ? field.value : ''}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
