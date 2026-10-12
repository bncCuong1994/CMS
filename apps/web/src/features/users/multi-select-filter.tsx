import { ChevronDownIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  /** Nhãn hiển thị trên nút, cũng là accessible name của trigger. */
  label: string;
  options: MultiSelectOption[];
  /** Các value đang chọn. Luôn là mảng mới mỗi lần đổi (không mutation). */
  value: string[];
  onChange: (next: string[]) => void;
  /** Dùng cho id ổn định của checkbox (vd "role", "status", "department"). */
  name: string;
  /** Ẩn nhãn `<span>` bên trong khi nhãn đã do thành phần ngoài render (vd `FormLabel`). Mặc định false. */
  hideLabel?: boolean;
}

/**
 * Bộ lọc chọn-nhiều: popover + danh sách checkbox. Hiển thị số lượng đã chọn trên nút
 * và nút Xoá lọc khi có lựa chọn. Thêm/bớt luôn tạo mảng mới (immutable).
 */
export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  name,
  hideLabel = false,
}: MultiSelectFilterProps) {
  const selectedCount = value.length;
  const triggerLabel = selectedCount > 0 ? `${label} (${selectedCount})` : label;

  function toggle(optionValue: string, checked: boolean) {
    const next = checked
      ? [...value, optionValue]
      : value.filter((v) => v !== optionValue);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && <span className="text-sm leading-none font-medium select-none">{label}</span>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={label}
            className="w-52 justify-between font-normal"
          >
            <span className={selectedCount > 0 ? '' : 'text-muted-foreground'}>{triggerLabel}</span>
            <ChevronDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {options.map((option) => {
              const id = `filter-${name}-${option.value}`;
              const checked = value.includes(option.value);
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(state) => toggle(option.value, state === true)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          {selectedCount > 0 && (
            <>
              <div className="my-2 flex flex-wrap gap-1">
                {value.map((v) => {
                  const option = options.find((o) => o.value === v);
                  return (
                    <Badge key={v} variant="secondary" className="font-normal">
                      {option?.label ?? v}
                    </Badge>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => onChange([])}
              >
                <XIcon />
                Xoá lọc
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
