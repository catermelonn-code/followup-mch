import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import {
  AuthedUser,
  ROLE_FROM_LABEL,
  ROLE_LABEL,
  cellStr,
  headerIndex,
} from '../util';

const STAFF_HEADERS = ['姓名', '工号', '登录名', '所属科室', '角色'];

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async departments() {
    return this.prisma.department.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  async list(user: AuthedUser, keyword?: string) {
    const where: Record<string, unknown> = {};
    if (user.role === 'dept_admin') where.deptId = user.deptId;
    if (user.role === 'nurse') where.id = user.id;
    if (keyword?.trim()) {
      const k = keyword.trim();
      where.OR = [
        { name: { contains: k } },
        { username: { contains: k } },
        { employeeNo: { contains: k } },
      ];
    }
    const rows = await this.prisma.staff.findMany({
      where,
      include: { dept: true },
      orderBy: [{ deptId: 'asc' }, { id: 'asc' }],
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      employeeNo: s.employeeNo,
      role: s.role,
      roleLabel: ROLE_LABEL[s.role],
      active: s.active,
      deptId: s.deptId,
      deptName: s.dept.name,
      createdAt: s.createdAt,
    }));
  }

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('科室人员');
    ws.addRow(STAFF_HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.addRow(['张敏', 'D001', 'zhangmin', '产科', '科室管理员']);
    ws.addRow(['李芳', 'N001', 'lifang', '产科', '普通医护']);
    ws.columns = [
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];
    const hint = wb.addWorksheet('填写说明');
    hint.addRow(['角色只能填：普通医护 / 科室管理员 / 系统管理员']);
    hint.addRow(['登录名全局唯一；工号全局唯一']);
    hint.addRow(['初始密码为 admin123，首次登录后请修改']);
    hint.addRow(['科室不存在时，系统管理员导入会自动创建']);
    hint.columns = [{ width: 60 }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async importExcel(user: AuthedUser, file: Express.Multer.File) {
    if (user.role === 'nurse') {
      throw new BadRequestException('普通医护不能导入人员');
    }
    if (!file?.buffer) throw new BadRequestException('请上传 Excel 文件');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('空表格');

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((c, i) => {
      headers[i] = cellStr(c.value);
    });
    const iName = headerIndex(headers, ['姓名']);
    const iNo = headerIndex(headers, ['工号']);
    const iUser = headerIndex(headers, ['登录名', '用户名', '账号']);
    const iDept = headerIndex(headers, ['所属科室', '科室']);
    const iRole = headerIndex(headers, ['角色']);
    if (iName < 0 || iNo < 0 || iUser < 0 || iDept < 0 || iRole < 0) {
      throw new BadRequestException(
        '表头必须包含：姓名、工号、登录名、所属科室、角色',
      );
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        kind: 'staff',
        filename: file.originalname || 'staff.xlsx',
        operatorId: user.id,
      },
    });

    const passwordHash = await bcrypt.hash('admin123', 10);
    const report: {
      rowNo: number;
      outcome: string;
      reason: string;
      raw: Record<string, string>;
    }[] = [];
    const seenUser = new Set<string>();
    const seenNo = new Set<string>();

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = cellStr(row.getCell(iName).value);
      const employeeNo = cellStr(row.getCell(iNo).value);
      const username = cellStr(row.getCell(iUser).value);
      const deptName = cellStr(row.getCell(iDept).value);
      const roleLabel = cellStr(row.getCell(iRole).value);
      const raw = { name, employeeNo, username, deptName, roleLabel };
      if (!name && !employeeNo && !username) continue;

      const fail = (reason: string) => {
        report.push({ rowNo: r, outcome: 'fail', reason, raw });
      };
      if (!name || !employeeNo || !username || !deptName || !roleLabel) {
        fail('姓名、工号、登录名、所属科室、角色均为必填');
        continue;
      }
      const role = ROLE_FROM_LABEL[roleLabel];
      if (!role) {
        fail('角色必须是：普通医护 / 科室管理员 / 系统管理员');
        continue;
      }
      if (user.role === 'dept_admin') {
        if (role === 'sys_admin') {
          fail('科室管理员不能创建系统管理员');
          continue;
        }
        if (deptName !== user.deptName) {
          fail('只能导入本科室人员');
          continue;
        }
      }
      if (seenUser.has(username) || seenNo.has(employeeNo)) {
        fail('文件内登录名或工号重复');
        continue;
      }
      seenUser.add(username);
      seenNo.add(employeeNo);

      try {
        let dept = await this.prisma.department.findUnique({
          where: { name: deptName },
        });
        if (!dept) {
          if (user.role !== 'sys_admin') {
            fail(`科室不存在：${deptName}`);
            continue;
          }
          const code = `d${Date.now().toString(36)}${r}`;
          dept = await this.prisma.department.create({
            data: { name: deptName, code },
          });
        }
        const existed = await this.prisma.staff.findFirst({
          where: { OR: [{ username }, { employeeNo }] },
        });
        if (existed) {
          await this.prisma.staff.update({
            where: { id: existed.id },
            data: { name, deptId: dept.id, role, active: true },
          });
          report.push({
            rowNo: r,
            outcome: 'skip',
            reason: '已存在，已更新姓名/科室/角色',
            raw,
          });
          continue;
        }
        await this.prisma.staff.create({
          data: {
            name,
            username,
            employeeNo,
            deptId: dept.id,
            role,
            passwordHash,
            mustChangePassword: true,
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

  async importBatches(user: AuthedUser, kind?: string) {
    const where: Record<string, unknown> = {};
    if (kind) where.kind = kind;
    if (user.role === 'nurse') where.operatorId = user.id;
    if (user.role === 'dept_admin') {
      const ids = (
        await this.prisma.staff.findMany({
          where: { deptId: user.deptId },
          select: { id: true },
        })
      ).map((s) => s.id);
      where.operatorId = { in: ids };
    }
    const batches = await this.prisma.importBatch.findMany({
      where,
      include: { operator: { include: { dept: true } } },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return batches.map((b) => ({
      id: b.id,
      kind: b.kind,
      filename: b.filename,
      operator: b.operator.name,
      deptName: b.operator.dept.name,
      successCount: b.successCount,
      skipCount: b.skipCount,
      failCount: b.failCount,
      createdAt: b.createdAt,
    }));
  }

  async importRows(user: AuthedUser, id: number) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: { operator: true, rows: { orderBy: { rowNo: 'asc' } } },
    });
    if (!batch) throw new BadRequestException('批次不存在');
    if (user.role === 'nurse' && batch.operatorId !== user.id) {
      throw new BadRequestException('无权查看');
    }
    if (user.role === 'dept_admin') {
      const op = await this.prisma.staff.findUnique({
        where: { id: batch.operatorId },
      });
      if (!op || op.deptId !== user.deptId) {
        throw new BadRequestException('无权查看');
      }
    }
    return {
      id: batch.id,
      filename: batch.filename,
      kind: batch.kind,
      rows: batch.rows.map((r) => ({
        rowNo: r.rowNo,
        outcome: r.outcome,
        reason: r.reason,
        raw: JSON.parse(r.rawJson || '{}'),
      })),
    };
  }

  ownersForFilter(user: AuthedUser) {
    const where = user.role === 'sys_admin' ? {} : { deptId: user.deptId };
    if (user.role === 'nurse') {
      return this.prisma.staff.findMany({
        where: { id: user.id },
        select: { id: true, name: true },
      });
    }
    return this.prisma.staff.findMany({
      where: { ...where, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
