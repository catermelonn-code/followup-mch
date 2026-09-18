import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import {
  AuthedUser,
  STATUS_LABEL,
  bizKey,
  cellStr,
  dateKey,
  headerIndex,
  normalizePhone,
  parseExcelDate,
  todayDate,
  visibleWhere,
} from '../util';

const TASK_HEADERS = [
  '姓名',
  '联系电话',
  '计划随访日期',
  '随访责任人',
  '备注',
  '随访类型',
  '所属科室',
];

type ListQuery = {
  name?: string;
  phone?: string;
  status?: string;
  deptId?: string;
  ownerId?: string;
  type?: string;
  planFrom?: string;
  planTo?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class FollowupService {
  constructor(private prisma: PrismaService) {}

  private taskWhere(user: AuthedUser, q: ListQuery): Prisma.FollowUpTaskWhereInput {
    const where: Prisma.FollowUpTaskWhereInput = {
      ...(visibleWhere(user) as Prisma.FollowUpTaskWhereInput),
    };
    if (q.name?.trim()) {
      where.patient = {
        ...(where.patient as object),
        name: { contains: q.name.trim() },
      };
    }
    if (q.phone?.trim()) {
      const p = normalizePhone(q.phone);
      where.patient = {
        ...(where.patient as object),
        phone: { contains: p },
      };
    }
    if (q.status === 'todo') {
      where.status = { in: ['pending', 'overdue'] };
    } else if (q.status === 'today') {
      const today = todayDate();
      where.OR = [
        { status: 'overdue' },
        { status: 'pending', planDate: today },
      ];
    } else if (q.status && ['pending', 'done', 'overdue'].includes(q.status)) {
      where.status = q.status as TaskStatus;
    }
    if (q.deptId) where.deptId = Number(q.deptId);
    if (q.ownerId) where.ownerId = Number(q.ownerId);
    if (q.type?.trim()) where.followUpType = q.type.trim();
    if (q.planFrom || q.planTo) {
      where.planDate = {};
      if (q.planFrom) where.planDate.gte = new Date(`${q.planFrom}T00:00:00.000Z`);
      if (q.planTo) where.planDate.lte = new Date(`${q.planTo}T00:00:00.000Z`);
    }
    return where;
  }

  serialize(t: any) {
    return {
      id: t.id,
      patientName: t.patient.name,
      phone: t.patient.phone,
      planDate: dateKey(t.planDate),
      status: t.status,
      statusLabel: STATUS_LABEL[t.status],
      followUpType: t.followUpType,
      note: t.note,
      resultText: t.resultText,
      completedAt: t.completedAt,
      deptId: t.deptId,
      deptName: t.dept.name,
      ownerId: t.ownerId,
      ownerName: t.owner.name,
      sourceRow: t.sourceRow,
      createdAt: t.createdAt,
      events: t.events?.map((e: any) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        detail: e.detail,
        at: e.at,
        actor: e.actor?.name || '系统',
      })),
    };
  }

  async list(user: AuthedUser, q: ListQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20));
    const where = this.taskWhere(user, q);
    const [total, rows] = await Promise.all([
      this.prisma.followUpTask.count({ where }),
      this.prisma.followUpTask.findMany({
        where,
        include: { patient: true, dept: true, owner: true },
        orderBy: [{ planDate: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: rows.map((t) => this.serialize(t)) };
  }

  async detail(user: AuthedUser, id: number) {
    const t = await this.prisma.followUpTask.findFirst({
      where: { id, ...(visibleWhere(user) as object) },
      include: {
        patient: true,
        dept: true,
        owner: true,
        events: { include: { actor: true }, orderBy: { at: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('任务不存在');
    return this.serialize(t);
  }

  async complete(user: AuthedUser, id: number, resultText: string) {
    const text = (resultText || '').trim();
    if (!text) throw new BadRequestException('请填写随访结果');
    const t = await this.prisma.followUpTask.findFirst({
      where: { id, ...(visibleWhere(user) as object) },
    });
    if (!t) throw new NotFoundException('任务不存在');
    if (t.status === 'done') {
      throw new BadRequestException('已随访记录不可再改');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.followUpTask.update({
        where: { id: t.id },
        data: {
          status: 'done',
          resultText: text,
          completedAt: new Date(),
          completedById: user.id,
        },
        include: { patient: true, dept: true, owner: true },
      });
      await tx.taskEvent.create({
        data: {
          taskId: t.id,
          actorId: user.id,
          fromStatus: t.status,
          toStatus: 'done',
          detail: text.slice(0, 200),
        },
      });
      return u;
    });
    return this.serialize(updated);
  }

  async types(user: AuthedUser) {
    const rows = await this.prisma.followUpTask.groupBy({
      by: ['followUpType'],
      where: visibleWhere(user) as object,
    });
    return rows.map((r) => r.followUpType).filter(Boolean);
  }

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('随访数据');
    ws.addRow(TASK_HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.addRow([
      '王芳',
      '13800001111',
      new Date(),
      '李芳',
      '产后第7天电话随访',
      '产后访视',
      '产科',
    ]);
    ws.getColumn(3).numFmt = 'yyyy-mm-dd';
    ws.columns = [
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
    ];
    const hint = wb.addWorksheet('填写说明');
    [
      '必填：姓名、联系电话、计划随访日期',
      '随访责任人可空，空则默认为导入人',
      '所属科室可空，空则默认为导入人科室',
      '随访类型可空，空则为「常规」',
      '备注可自由填写，建议写随访要点',
      '增量键：电话 + 姓名 + 计划日期。同一天同一人重复行会失败',
      '已随访记录再次导入会被跳过，不会覆盖结果',
      '待随访/已逾期再次导入：更新备注、责任人、类型、科室',
    ].forEach((l) => hint.addRow([l]));
    hint.columns = [{ width: 72 }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async importExcel(user: AuthedUser, file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('请上传 Excel 文件');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('空表格');
    if (ws.rowCount > 5002) {
      throw new BadRequestException('单次最多导入 5000 行');
    }

    const headers: string[] = [];
    ws.getRow(1).eachCell((c, i) => {
      headers[i] = cellStr(c.value);
    });
    const iName = headerIndex(headers, ['姓名']);
    const iPhone = headerIndex(headers, ['联系电话', '电话', '手机号']);
    const iDate = headerIndex(headers, ['计划随访日期', '随访日期', '计划日期']);
    const iOwner = headerIndex(headers, ['随访责任人', '责任人']);
    const iNote = headerIndex(headers, ['备注']);
    const iType = headerIndex(headers, ['随访类型', '类型']);
    const iDept = headerIndex(headers, ['所属科室', '科室']);
    if (iName < 0 || iPhone < 0 || iDate < 0) {
      throw new BadRequestException('表头必须包含：姓名、联系电话、计划随访日期');
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        kind: 'followup',
        filename: file.originalname || 'followup.xlsx',
        operatorId: user.id,
      },
    });

    const [allStaff, allDepts] = await Promise.all([
      this.prisma.staff.findMany({ where: { active: true }, include: { dept: true } }),
      this.prisma.department.findMany(),
    ]);

    const report: {
      rowNo: number;
      outcome: string;
      reason: string;
      raw: Record<string, string>;
    }[] = [];
    const seen = new Set<string>();

    const matchOwner = (name: string, deptId: number) => {
      if (!name) return allStaff.find((s) => s.id === user.id) || null;
      const inDept = allStaff.filter((s) => s.name === name && s.deptId === deptId);
      if (inDept.length === 1) return inDept[0];
      if (inDept.length > 1) return 'ambiguous' as const;
      const global = allStaff.filter((s) => s.name === name);
      if (global.length === 1) return global[0];
      if (global.length > 1) return 'ambiguous' as const;
      return null;
    };

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = iName > 0 ? cellStr(row.getCell(iName).value) : '';
      const phoneRaw = iPhone > 0 ? cellStr(row.getCell(iPhone).value) : '';
      const phone = normalizePhone(phoneRaw || row.getCell(iPhone).value);
      const plan = iDate > 0 ? parseExcelDate(row.getCell(iDate).value) : null;
      const ownerName = iOwner > 0 ? cellStr(row.getCell(iOwner).value) : '';
      const note = iNote > 0 ? cellStr(row.getCell(iNote).value) : '';
      const followUpType =
        (iType > 0 ? cellStr(row.getCell(iType).value) : '') || '常规';
      const deptName = iDept > 0 ? cellStr(row.getCell(iDept).value) : '';
      const raw = {
        name,
        phone: phoneRaw || phone,
        planDate: plan ? dateKey(plan) : '',
        ownerName,
        note,
        followUpType,
        deptName,
      };
      if (!name && !phone && !plan) continue;

      const fail = (reason: string) => {
        report.push({ rowNo: r, outcome: 'fail', reason, raw });
      };
      if (!name) {
        fail('姓名必填');
        continue;
      }
      if (phone.length < 7 || phone.length > 15) {
        fail('联系电话需为 7–15 位数字');
        continue;
      }
      if (!plan) {
        fail('计划随访日期无效');
        continue;
      }
      if (note.length > 2000) {
        fail('备注过长（最多 2000 字）');
        continue;
      }

      let dept =
        (deptName && allDepts.find((d) => d.name === deptName)) ||
        allDepts.find((d) => d.id === user.deptId);
      if (deptName && !allDepts.find((d) => d.name === deptName)) {
        fail(`科室不存在：${deptName}`);
        continue;
      }
      if (!dept) {
        fail('无法确定所属科室');
        continue;
      }
      if (user.role !== 'sys_admin' && dept.id !== user.deptId) {
        fail('只能导入本科室随访任务');
        continue;
      }

      const owner = matchOwner(ownerName, dept.id);
      if (owner === 'ambiguous') {
        fail(`随访责任人不唯一：${ownerName}`);
        continue;
      }
      if (!owner) {
        fail(ownerName ? `找不到随访责任人：${ownerName}` : '无法确定随访责任人');
        continue;
      }
      if (user.role === 'nurse' && owner.id !== user.id) {
        fail('普通医护只能导入自己负责的任务');
        continue;
      }
      if (user.role === 'dept_admin' && owner.deptId !== user.deptId) {
        fail('责任人必须属于本科室');
        continue;
      }

      const key = bizKey(phone, name, plan);
      if (seen.has(key)) {
        fail('文件内重复（同一姓名+电话+计划日期）');
        continue;
      }
      seen.add(key);

      try {
        const existing = await this.prisma.followUpTask.findUnique({
          where: { bizKey: key },
        });
        if (existing?.status === 'done') {
          report.push({
            rowNo: r,
            outcome: 'skip',
            reason: '已随访，跳过不覆盖',
            raw,
          });
          continue;
        }

        const patient = await this.prisma.patient.upsert({
          where: { phone_name: { phone, name } },
          update: { deptId: dept.id },
          create: { phone, name, deptId: dept.id },
        });

        if (existing) {
          await this.prisma.followUpTask.update({
            where: { id: existing.id },
            data: {
              note,
              followUpType,
              ownerId: owner.id,
              deptId: dept.id,
              patientId: patient.id,
              importBatchId: batch.id,
              sourceRow: r,
            },
          });
          report.push({
            rowNo: r,
            outcome: 'skip',
            reason: '已存在待随访/已逾期，已更新备注与责任人',
            raw,
          });
          continue;
        }

        const created = await this.prisma.followUpTask.create({
          data: {
            patientId: patient.id,
            deptId: dept.id,
            ownerId: owner.id,
            planDate: plan,
            status: plan < todayDate() ? 'overdue' : 'pending',
            followUpType,
            note,
            bizKey: key,
            importBatchId: batch.id,
            sourceRow: r,
          },
        });
        await this.prisma.taskEvent.create({
          data: {
            taskId: created.id,
            actorId: user.id,
            fromStatus: null,
            toStatus: created.status,
            detail: `导入创建（第 ${r} 行）`,
          },
        });
        report.push({ rowNo: r, outcome: 'success', reason: '新建', raw });
      } catch (e: any) {
        fail(e?.message || '写入失败');
      }
    }

    const successCount = report.filter((x) => x.outcome === 'success').length;
    const skipCount = report.filter((x) => x.outcome === 'skip').length;
    const failCount = report.filter((x) => x.outcome === 'fail').length;
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: { successCount, skipCount, failCount },
    });
    if (report.length) {
      await this.prisma.importRow.createMany({
        data: report.map((x) => ({
          batchId: batch.id,
          rowNo: x.rowNo,
          rawJson: JSON.stringify(x.raw),
          outcome: x.outcome,
          reason: x.reason,
        })),
      });
    }
    return {
      batchId: batch.id,
      successCount,
      skipCount,
      failCount,
      rows: report,
    };
  }

  async export(user: AuthedUser, q: ListQuery): Promise<Buffer> {
    const where = this.taskWhere(user, q);
    const rows = await this.prisma.followUpTask.findMany({
      where,
      include: { patient: true, dept: true, owner: true, completedBy: true },
      orderBy: [{ planDate: 'asc' }, { id: 'asc' }],
      take: 20000,
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('随访记录');
    ws.addRow([
      '姓名',
      '联系电话',
      '计划随访日期',
      '状态',
      '随访类型',
      '所属科室',
      '随访责任人',
      '备注',
      '随访结果',
      '完成时间',
      '完成人',
    ]);
    ws.getRow(1).font = { bold: true };
    for (const t of rows) {
      ws.addRow([
        t.patient.name,
        t.patient.phone,
        dateKey(t.planDate),
        STATUS_LABEL[t.status],
        t.followUpType,
        t.dept.name,
        t.owner.name,
        t.note,
        t.resultText || '',
        t.completedAt ? t.completedAt.toISOString() : '',
        t.completedBy?.name || '',
      ]);
    }
    ws.columns = [12, 16, 16, 12, 14, 14, 14, 28, 28, 22, 12].map((width) => ({
      width,
    }));
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
