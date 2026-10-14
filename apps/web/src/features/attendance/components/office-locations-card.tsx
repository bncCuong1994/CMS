import type { OfficeLocation } from '@cms/shared-types';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeleteOfficeLocation } from '../api';
import { TEXT } from '../labels';
import { OfficeLocationDialog } from './office-location-dialog';

const COORD_FRACTION_DIGITS = 6;
const formatCoord = (value: number) => value.toFixed(COORD_FRACTION_DIGITS);

export function OfficeLocationsCard({
  locations,
  canWrite,
}: {
  locations: OfficeLocation[];
  /** false = chế độ chỉ xem: ẩn nút Thêm/Sửa/Xoá, không mở dialog, không gọi mutation. */
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<OfficeLocation | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<OfficeLocation | null>(null);
  const deleteLocation = useDeleteOfficeLocation();

  async function confirmDelete() {
    if (!canWrite || !deleting) return;
    try {
      await deleteLocation.mutateAsync(deleting.id);
      toast.success(TEXT.locationDeleted);
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : TEXT.genericError);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{TEXT.locationsTitle}</CardTitle>
          <CardDescription>{TEXT.locationsDescription}</CardDescription>
        </div>
        {canWrite && (
          <Button onClick={() => setAdding(true)}>
            <Plus />
            {TEXT.addLocation}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{TEXT.locationsEmpty}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{TEXT.colName}</TableHead>
                  <TableHead>{TEXT.colCoords}</TableHead>
                  <TableHead>{TEXT.colRadius}</TableHead>
                  <TableHead>{TEXT.colStatus}</TableHead>
                  {canWrite && <TableHead className="text-right">{TEXT.colActions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCoord(loc.latitude)}, {formatCoord(loc.longitude)}
                    </TableCell>
                    <TableCell className="tabular-nums">{loc.radiusM}</TableCell>
                    <TableCell>
                      <Badge variant={loc.isActive ? 'secondary' : 'outline'}>
                        {loc.isActive ? TEXT.statusActive : TEXT.statusInactive}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(loc)}
                            aria-label={`${TEXT.edit} ${loc.name}`}
                          >
                            <Pencil />
                            {TEXT.edit}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleting(loc)}
                            aria-label={`${TEXT.delete} ${loc.name}`}
                          >
                            <Trash2 />
                            {TEXT.delete}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {canWrite && adding && (
        <OfficeLocationDialog
          location={null}
          open={adding}
          onOpenChange={(next) => setAdding(next)}
        />
      )}

      {canWrite && editing && (
        <OfficeLocationDialog
          key={editing.id}
          location={editing}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}

      <Dialog open={canWrite && deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{TEXT.deleteTitle}</DialogTitle>
            <DialogDescription>{deleting ? TEXT.deleteConfirm(deleting.name) : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {TEXT.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLocation.isPending}
            >
              {deleteLocation.isPending ? TEXT.deleting : TEXT.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
