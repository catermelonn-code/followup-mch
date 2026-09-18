export type AuthedUser = {
  id: number;
  name: string;
  username: string;
  role: 'nurse' | 'dept_admin' | 'sys_admin';
  deptId: number;
  deptName: string;
  mustChangePassword: boolean;
};

export function visibleWhere(user: AuthedUser): Record<string, unknown> {
  if (user.role === 'sys_admin') return {};
  if (user.role === 'dept_admin') return { deptId: user.deptId };
  return { ownerId: user.id };
}

export function todayDate(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function normalizePhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function bizKey(phone: string, name: string, planDate: Date): string {
  return `${phone}|${name}|${dateKey(planDate)}`;
}

export function cellValue(raw: unknown): unknown {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if ('result' in o) return o.result;
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((t) => t.text || '').join('');
    }
    if ('text' in o) return o.text;
    if ('hyperlink' in o && 'text' in o) return o.text;
  }
  return raw;
}

export function cellStr(raw: unknown): string {
  const v = cellValue(raw);
  if (v == null) return '';
  if (v instanceof Date) return '';
  return String(v).trim();
}

export function parseExcelDate(raw: unknown): Date | null {
  const v = cellValue(raw);
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = Math.round(v * 86400000);
    const d = new Date(epoch + ms);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  return null;
}

export function headerIndex(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = headers.findIndex((h) => {
      if (!h) return false;
      const compact = String(h).replace(/\s/g, '');
      return h === a || compact === a || compact === a.replace(/\s/g, '');
    });
    if (i >= 0) return i;
  }
  return -1;
}

export const ROLE_LABEL: Record<string, string> = {
  nurse: '普通医护',
  dept_admin: '科室管理员',
  sys_admin: '系统管理员',
};

export const ROLE_FROM_LABEL: Record<string, AuthedUser['role']> = {
  普通医护: 'nurse',
  科室管理员: 'dept_admin',
  系统管理员: 'sys_admin',
  nurse: 'nurse',
  dept_admin: 'dept_admin',
  sys_admin: 'sys_admin',
};

export const STATUS_LABEL: Record<string, string> = {
  pending: '待随访',
  done: '已随访',
  overdue: '已逾期',
};

export const MATERNAL_TYPES = ['孕早期随访', '孕晚期随访', '产后访视', '术后随访'];
export const CHILD_TYPES = ['儿童体检', '儿童随访', '儿童保健'];

export function isMaternalType(t: string): boolean {
  return MATERNAL_TYPES.includes(t) || t.includes('孕') || t.includes('产');
}

export function isChildType(t: string): boolean {
  return CHILD_TYPES.includes(t) || t.includes('儿童') || t.includes('儿保');
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
