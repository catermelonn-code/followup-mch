import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role, TaskStatus } from '@prisma/client';
import { bizKey, todayDate } from './util';

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗'.split('');
const GIVEN = [
  '芳',
  '伟',
  '娜',
  '敏',
  '静',
  '丽',
  '强',
  '磊',
  '洋',
  '杰',
  '雪',
  '婷',
  '浩',
  '宇',
  '倩',
  '鹏',
];

export async function seedIfEmpty(prisma: PrismaClient) {
  const n = await prisma.staff.count();
  if (n > 0) return { seeded: false };

  const passwordHash = await bcrypt.hash('admin123', 10);
  const depts = await prisma.$transaction([
    prisma.department.create({ data: { name: '产科', code: 'obstetrics' } }),
    prisma.department.create({ data: { name: '儿科', code: 'pediatrics' } }),
    prisma.department.create({ data: { name: '妇科', code: 'gynecology' } }),
    prisma.department.create({
      data: { name: '儿童保健科', code: 'childcare' },
    }),
    prisma.department.create({ data: { name: '信息科', code: 'it' } }),
  ]);
  const [ob, ped, gyn, cc, it] = depts;

  const staffData: {
    name: string;
    username: string;
    employeeNo: string;
    role: Role;
    deptId: number;
  }[] = [
    { name: '系统管理员', username: 'admin', employeeNo: 'A001', role: 'sys_admin', deptId: it.id },
    { name: '张敏', username: 'dept01', employeeNo: 'D001', role: 'dept_admin', deptId: ob.id },
    { name: '李芳', username: 'nurse01', employeeNo: 'N001', role: 'nurse', deptId: ob.id },
    { name: '王强', username: 'dept02', employeeNo: 'D002', role: 'dept_admin', deptId: ped.id },
    { name: '刘洋', username: 'nurse02', employeeNo: 'N002', role: 'nurse', deptId: ped.id },
    { name: '黄伟', username: 'dept03', employeeNo: 'D003', role: 'dept_admin', deptId: gyn.id },
    { name: '陈静', username: 'nurse03', employeeNo: 'N003', role: 'nurse', deptId: gyn.id },
    { name: '周杰', username: 'dept04', employeeNo: 'D004', role: 'dept_admin', deptId: cc.id },
    { name: '赵丽', username: 'nurse04', employeeNo: 'N004', role: 'nurse', deptId: cc.id },
    { name: '吴娜', username: 'nurse05', employeeNo: 'N005', role: 'nurse', deptId: ob.id },
  ];

  await prisma.staff.createMany({
    data: staffData.map((s) => ({
      ...s,
      passwordHash,
      mustChangePassword: false,
    })),
  });
  const staff = await prisma.staff.findMany();
  type StaffRow = (typeof staff)[number];
  const byUser: Record<string, StaffRow> = Object.fromEntries(
    staff.map((s) => [s.username, s]),
  );
  const ownersByDept: Record<number, StaffRow[]> = {};
  for (const s of staff) {
    if (s.role === 'sys_admin') continue;
    ownersByDept[s.deptId] = ownersByDept[s.deptId] || [];
    ownersByDept[s.deptId].push(s);
  }

  const rand = mulberry32(20260831);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const today = todayDate();

  const typesByDept: Record<number, string[]> = {
    [ob.id]: ['孕早期随访', '孕晚期随访', '产后访视'],
    [ped.id]: ['儿童体检', '儿童随访'],
    [gyn.id]: ['术后随访', '常规'],
    [cc.id]: ['儿童体检', '儿童保健'],
  };

  const patients: { name: string; phone: string; deptId: number }[] = [];
  const usedPhone = new Set<string>();
  for (let i = 0; i < 420; i++) {
    let phone = '';
    do {
      phone = `138${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`;
    } while (usedPhone.has(phone));
    usedPhone.add(phone);
    const dept = pick([ob, ped, gyn, cc]);
    patients.push({
      name: pick(SURNAMES) + pick(GIVEN) + (rand() > 0.7 ? pick(GIVEN) : ''),
      phone,
      deptId: dept.id,
    });
  }
  await prisma.patient.createMany({ data: patients });
  const saved = await prisma.patient.findMany();

  const tasks: {
    patientId: number;
    deptId: number;
    ownerId: number;
    planDate: Date;
    status: TaskStatus;
    followUpType: string;
    note: string;
    resultText: string | null;
    completedAt: Date | null;
    completedById: number | null;
    bizKey: string;
  }[] = [];
  const usedKey = new Set<string>();

  const addTask = (
    p: (typeof saved)[number],
    offsetDays: number,
    forceStatus?: TaskStatus,
  ) => {
    const plan = new Date(today);
    plan.setUTCDate(plan.getUTCDate() + offsetDays);
    const key = bizKey(p.phone, p.name, plan);
    if (usedKey.has(key)) return;
    usedKey.add(key);
    const deptId = p.deptId ?? ob.id;
    const owners = ownersByDept[deptId] || [byUser.nurse01];
    const owner = pick(owners);
    const followUpType = pick(typesByDept[deptId] || ['常规']);
    let status: TaskStatus = 'pending';
    if (forceStatus) status = forceStatus;
    else if (offsetDays < 0) status = rand() < 0.82 ? 'done' : 'overdue';
    else status = 'pending';
    const done = status === 'done';
    tasks.push({
      patientId: p.id,
      deptId,
      ownerId: owner.id,
      planDate: plan,
      status,
      followUpType,
      note: `${followUpType}，按科室常规随访。`,
      resultText: done ? '电话接通，情况稳定，已宣教注意事项。' : null,
      completedAt: done
        ? new Date(plan.getTime() + 8 * 3600 * 1000)
        : null,
      completedById: done ? owner.id : null,
      bizKey: key,
    });
  };

  for (const p of saved) {
    const nTasks = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < nTasks; k++) {
      const offset = Math.floor(rand() * 360) - 300;
      addTask(p, offset);
    }
  }

  const todayPool = saved.slice(0, 80);
  const todoTypes: [number, string, number][] = [
    [28, '孕晚期随访', ob.id],
    [12, '产后访视', ob.id],
    [35, '儿童体检', cc.id],
  ];
  let cursor = 0;
  for (const [count, type, deptId] of todoTypes) {
    for (let i = 0; i < count; i++) {
      const p =
        saved.find((x, idx) => idx >= cursor && x.deptId === deptId) ||
        todayPool[i % todayPool.length];
      cursor += 1;
      const overdue = i % 5 === 0;
      const plan = new Date(today);
      if (overdue) plan.setUTCDate(plan.getUTCDate() - (1 + (i % 3)));
      const owners = ownersByDept[deptId] || staff;
      const owner = pick(owners);
      const key = bizKey(p.phone, p.name + (overdue ? '' : ''), plan);
      const uniqKey = usedKey.has(key)
        ? bizKey(p.phone, p.name, new Date(plan.getTime() + 86400000 * ((i % 7) - 10)))
        : key;
      if (usedKey.has(uniqKey)) continue;
      usedKey.add(uniqKey);
      const realPlan = new Date(uniqKey.split('|')[2] + 'T00:00:00.000Z');
      tasks.push({
        patientId: p.id,
        deptId,
        ownerId: owner.id,
        planDate: realPlan,
        status: realPlan < today ? 'overdue' : 'pending',
        followUpType: type,
        note: `今日待办：${type}`,
        resultText: null,
        completedAt: null,
        completedById: null,
        bizKey: uniqKey,
      });
    }
  }

  const chunk = 200;
  for (let i = 0; i < tasks.length; i += chunk) {
    await prisma.followUpTask.createMany({ data: tasks.slice(i, i + chunk) });
  }
  return { seeded: true, patients: saved.length, tasks: tasks.length };
}
