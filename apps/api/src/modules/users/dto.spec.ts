import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUserDto } from './dto';

const MAX_PHONE_LENGTH = 20;

function validateBody(overrides: Partial<CreateUserDto>) {
  const dto = plainToInstance(CreateUserDto, {
    email: 'nhan.vien@example.com',
    fullName: 'Nguyễn Văn A',
    password: 'matkhau123',
    departmentId: '018f3a2e-0000-7000-8000-000000000001',
    role: 'USER',
    ...overrides,
  });
  return validateSync(dto);
}

describe('CreateUserDto', () => {
  it('chấp nhận body không có phone', () => {
    const errors = validateBody({});

    expect(errors).toHaveLength(0);
  });

  it(`chấp nhận phone dài đúng ${MAX_PHONE_LENGTH} ký tự`, () => {
    const errors = validateBody({ phone: '0'.repeat(MAX_PHONE_LENGTH) });

    expect(errors).toHaveLength(0);
  });

  it(`từ chối phone dài hơn ${MAX_PHONE_LENGTH} ký tự`, () => {
    const errors = validateBody({ phone: '0'.repeat(MAX_PHONE_LENGTH + 1) });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('phone');
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});
