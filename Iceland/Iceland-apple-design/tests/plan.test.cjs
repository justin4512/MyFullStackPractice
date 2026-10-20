/* 行程調整（js/plan.js）的純函式測試：node --test tests/ */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ctx = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/plan.js'), 'utf8'), ctx);
const P = ctx.window.IcelandPlan;
const fresh = () => JSON.parse(JSON.stringify(ctx.window.DATA));
const leg = (km, min, extra) => Object.assign({km, min, roads: [['1', km]], coords: [[-14, 64], [-14.1, 64.1]]}, extra || {});
const ids = (D, day) => P.dayStops(D, day).map(l => l.id);

test('Given an untouched plan, applying it changes nothing', () => {
  const D = fresh(), before = JSON.stringify(D);
  P.applyPlan(D, {schema: 1, days: {}});
  assert.equal(JSON.stringify(D), before);
});

test('Given a stop removed from a day, that day is recalculated from its saved legs', () => {
  const D = fresh();
  const plan = P.dayToPlan(D, 7);
  const i = plan.stops.findIndex(s => s.ref === 'egilsstadir');
  plan.stops.splice(i, 1);
  plan.legs.splice(i, 2, leg(150, 140));                 // 迪尤皮沃格爾 → Mjóeyri 直接一段
  P.applyPlan(D, {schema: 1, days: {7: plan}});
  const d7 = D.days.find(d => d.day === 7);
  const expectKm = plan.legs.reduce((a, l) => a + (l ? l.km : 0), 0);
  assert.equal(d7.route_km, Math.round(expectKm * 10) / 10);
  assert.equal(d7.drive_min_winter, Math.round(plan.legs.reduce((a, l) => a + (l ? l.min : 0), 0) * 1.2));
  assert.equal(d7.edited, 1);
  assert.ok(!ids(D, 7).includes('egilsstadir'));
  assert.equal(D.routes.features.filter(f => f.properties.day === 7).length, plan.stops.length);
});

test('Given a stop removed whose place recurs the next day, the next day takes over the shared marker', () => {
  const D = fresh();
  const plan = P.dayToPlan(D, 7);
  const i = plan.stops.findIndex(s => s.ref === 'egilsstadir');
  plan.stops.splice(i, 1); plan.legs.splice(i, 2, leg(150, 140));
  P.applyPlan(D, {schema: 1, days: {7: plan}});
  const e8 = P.dayStops(D, 8).find(l => P.baseOf(l) === 'egilsstadir');
  assert.equal(e8.id, 'egilsstadir');
  assert.equal(e8.same_as, undefined);
  const f = D.routes.features.find(f => f.properties.day === 8 && f.properties.seq === 1);
  assert.equal(f.properties.to, 'egilsstadir');            // 路線也跟著改 id
});

test('Given a place from another day added, it becomes a second visit sharing one marker', () => {
  const D = fresh();
  const plan = P.dayToPlan(D, 7);
  plan.stops.splice(plan.stops.length - 1, 0, {ref: 'myvatn'});
  plan.legs.splice(plan.legs.length - 1, 1, leg(100, 90), leg(120, 110));
  P.applyPlan(D, {schema: 1, days: {7: plan}});
  const m7 = P.dayStops(D, 7).find(l => P.baseOf(l) === 'myvatn');
  assert.equal(m7.id, 'myvatn');                          // Day 7 先到，成為主標記
  const m8 = P.dayStops(D, 8).find(l => P.baseOf(l) === 'myvatn');
  assert.equal(m8.same_as, 'myvatn');
  assert.notEqual(m8.id, 'myvatn');
  const all = D.locations.map(l => l.id);
  assert.equal(new Set(all).size, all.length, 'ids stay unique');
});

test('Given a custom place from search, it gets a stop with visit time counted', () => {
  const D = fresh();
  const plan = P.dayToPlan(D, 9);
  plan.stops.splice(1, 0, {custom: {id: 'c_test1', name_zh: '測試景點', lat: 65.7, lon: -18, visit_min: 40}});
  plan.legs.splice(1, 1, leg(10, 12), leg(15, 14));
  const visitBefore = D.days.find(d => d.day === 9).visit_min;
  P.applyPlan(D, {schema: 1, days: {9: plan}});
  const c = P.dayStops(D, 9).find(l => l.id === 'c_test1');
  assert.equal(c.custom, 1);
  assert.equal(c.order, 2);
  assert.equal(D.days.find(d => d.day === 9).visit_min, visitBefore + 40);
});

test('Given an optional place promoted to a stop on its own day, it is no longer listed twice', () => {
  const D = fresh();
  const plan = P.dayToPlan(D, 6);
  plan.stops.splice(plan.stops.length - 1, 0, {ref: 'skaftafell'});
  plan.legs.splice(plan.legs.length - 1, 1, leg(50, 40), leg(130, 100));
  P.applyPlan(D, {schema: 1, days: {6: plan}});
  assert.equal(D.locations.filter(l => P.baseOf(l) === 'skaftafell').length, 1);
  assert.equal(D.locations.find(l => l.id === 'skaftafell').optional, 0);
});

test('Given an edited day, other days keep their numbers', () => {
  const D = fresh(), base = fresh();
  const plan = P.dayToPlan(D, 7);
  plan.stops.splice(1, 1); plan.legs.splice(1, 2, leg(60, 50));
  P.applyPlan(D, {schema: 1, days: {7: plan}});
  D.days.filter(d => d.day !== 7).forEach(d => {
    const b = base.days.find(x => x.day === d.day);
    assert.equal(d.route_km, b.route_km); assert.equal(d.drive_min, b.drive_min);
  });
});

test('Given OSRM steps, roads are merged like the build script and closed roads are flagged', () => {
  const step = (ref, m, coords) => ({ref, name: '', distance: m, geometry: {coordinates: coords}});
  const json = {code: 'Ok', routes: [{distance: 12500, duration: 900, legs: [{steps: [
    step('1', 5000, [[0, 0], [0.1, 0]]), step('', 30, [[0.1, 0], [0.1001, 0]]), step('1', 2000, [[0.1001, 0], [0.2, 0]]),
    step('939', 5000, [[0.2, 0], [0.3, 0.1]]), step('F936', 500, [[0.3, 0.1], [0.31, 0.1]])]}]}]};
  const l = P.legFromOsrm(json);
  assert.equal(l.km, 12.5); assert.equal(l.min, 15);
  assert.equal(JSON.stringify(l.roads), JSON.stringify([['1', 7], ['939', 5]]));
  assert.equal(JSON.stringify(P.closedRoads([['1', 7], ['939', 5], ['F936', 2]])), JSON.stringify(['939', 'F936']));
});
