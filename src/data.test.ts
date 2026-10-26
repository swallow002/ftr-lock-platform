import { describe, expect, it } from 'vitest';
import { DEMO_TRAIN, FLEET, filterDevices, INSPECTION_VEHICLE, monitoringSnapshot, operationDuration, operationSnapshot, REGIONAL_DEVICES, STAGES, transitPosition, type Operation } from './data';

describe('固定模拟设备与统计', () => {
  it('生成440把唯一锁具、110辆车，演示列车13辆', () => {
    const locks = FLEET.flatMap(v => v.locks);
    expect(locks).toHaveLength(440);
    expect(new Set(locks.map(d => d.id)).size).toBe(440);
    expect(FLEET.every(v => v.locks.length === 4)).toBe(true);
    expect(DEMO_TRAIN).toHaveLength(13);
    expect(DEMO_TRAIN[0].id).toBe('X70 5306203');
    expect(INSPECTION_VEHICLE).toBe(DEMO_TRAIN[0].id);
  });
  it('区域58把中55正常在线、3离线异常', () => {
    expect(REGIONAL_DEVICES).toHaveLength(58);
    expect(filterDevices('', 'normal')).toHaveLength(55);
    expect(filterDevices('', 'abnormal')).toHaveLength(3);
    expect(filterDevices('', 'offline')).toHaveLength(3);
    expect(filterDevices('', 'abnormal').every(d => !d.online)).toBe(true);
    expect(REGIONAL_DEVICES[25].id).toBe('F-TR-026');
  });
  it('编号、车号搜索与状态筛选组合，并处理空结果', () => {
    expect(filterDevices(' f-tr-026 ', 'all')).toHaveLength(1);
    expect(filterDevices('X705306203', 'all')).toHaveLength(4);
    expect(filterDevices('F-TR-026', 'offline')).toHaveLength(0);
    expect(filterDevices('不存在的设备', 'all')).toHaveLength(0);
  });
});

describe('装卸流程的关键边界', () => {
  it('装车保留2.6cm、两次0.34°及3.5cm，跨阶段受力归零', () => {
    const initial = operationSnapshot('loading', 0, false);
    expect(initial.force).toEqual([0, 0, 0, 0]);
    expect(operationSnapshot('loading', 0).distance).toBe(2.6);
    expect(operationSnapshot('loading', 6).angle).toBe(.34);
    expect(operationSnapshot('loading', 11.99).force[2]).toBeGreaterThan(57);
    expect(operationSnapshot('loading', 12).force).toEqual([0, 0, 0, 0]);
    expect(operationSnapshot('loading', 12).distance).toBe(3.5);
    expect(operationSnapshot('loading', 17).angle).toBe(.34);
    expect(operationSnapshot('loading', 24).surfaces).toEqual(Array(4).fill('重力面'));
  });
  it('松钩提示恰好2秒后清除，完成后保持61至63kN', () => {
    expect(operationSnapshot('loading', 25.99).instruction).toBe('吊钩松开');
    expect(operationSnapshot('loading', 26).instruction).toBe('无');
    const complete = operationSnapshot('loading', 30);
    expect(complete.complete).toBe(true);
    expect(complete.force.every(f => f >= 61 && f <= 63)).toBe(true);
  });
  it('换轨装车为2.7cm；换轨卸车5m与独立卸车5cm区分', () => {
    expect(operationSnapshot('transfer-load', 0).distance).toBe(2.7);
    expect(operationSnapshot('transfer-load', 0, false).transfer).toBe(1);
    const transfer = operationSnapshot('transfer-unload', 20);
    expect(transfer.distance).toBe(5); expect(transfer.unit).toBe('m');
    const unloading = operationSnapshot('unloading', 24);
    expect(unloading.distance).toBe(5); expect(unloading.unit).toBe('cm');
  });
  it('卡阻只作用于第一把锁，处理后清零并关闭弹窗', () => {
    const jam = operationSnapshot('unloading', 15);
    expect(jam.jam).toBe(true); expect(jam.force).toEqual([63, 0, 0, 0]);
    expect(jam.angle).toBe(.2); expect(jam.surfaces[0]).toBe('提箱阻挡面');
    const lifted = operationSnapshot('unloading', 24);
    expect(lifted.jam).toBe(false); expect(lifted.force).toEqual([0, 0, 0, 0]);
  });
  it('换轨卸车后5秒跨轨移动，结束停在目标车上方', () => {
    expect(operationSnapshot('transfer-unload', 30).transfer).toBe(0);
    expect(operationSnapshot('transfer-unload', 32.5).transfer).toBeCloseTo(.5);
    const final = operationSnapshot('transfer-unload', 35);
    expect(final.transfer).toBe(1); expect(final.complete).toBe(true);
    expect(final.instruction).toBe('等待装车');
  });
  it('全部流程每个时间点均有有效快照，重播结果一致', () => {
    (Object.keys(STAGES) as Operation[]).forEach(op => {
      expect(operationDuration(op)).toBe(op === 'transfer-unload' ? 35 : 30);
      for (let t = 0; t <= operationDuration(op); t += .25) {
        const s = operationSnapshot(op, t);
        expect(s.force).toHaveLength(4); expect(s.force.every(f => Number.isFinite(f) && f >= 0)).toBe(true);
        expect(s.progress).toBeGreaterThanOrEqual(0); expect(s.progress).toBeLessThanOrEqual(1);
        expect(operationSnapshot(op, t)).toEqual(s);
      }
    });
  });
});

describe('独立监控场景', () => {
  it('货检异常与正常监管使用各自的受力快照', () => {
    expect(monitoringSnapshot('inspection', 0, true).force[0]).toBe(72);
    expect(monitoringSnapshot('inspection', 0, true).force[2]).toBeLessThan(54);
    expect(monitoringSnapshot('transit', 0).phase).toBe('正常运行');
    expect(monitoringSnapshot('inspection', 0, false).phase).toBe('正常运行');
  });
  it('列车往返轨迹在折返点和循环点连续', () => {
    const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(transitPosition(0)).toEqual([32.144722, 118.883611]);
    expect(distance(transitPosition(359.99), transitPosition(360.01))).toBeLessThan(.0001);
    expect(distance(transitPosition(719.99), transitPosition(720.01))).toBeLessThan(.0001);
  });
  it('正常监控小幅波动始终保持在61至63kN内', () => {
    for (let time = 0; time < 60; time += .5) {
      expect(monitoringSnapshot('transit', time).force.every(f => f >= 61 && f <= 63)).toBe(true);
    }
  });
});
