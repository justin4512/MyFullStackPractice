/* Shared, deterministic gesture physics. All velocities are pixels / second. */
(function () {
  'use strict';
  window.IcelandInteraction = {
    visible: function (height, current, target) { return Math.max(0, height - Math.min(current, target)); },
    rubber: function (distance, size) {
      return distance * size * .55 / (size + .55 * Math.abs(distance));
    },
    velocity: function (samples, now) {
      if (samples.length < 2 || now - samples[samples.length - 1].t > 80) return 0;
      var last = samples[samples.length - 1];
      var first = samples.filter(function (p) { return last.t - p.t <= 100; })[0];
      return first && last.t > first.t ? (last.y - first.y) * 1000 / (last.t - first.t) : 0;
    },
    snap: function (y, velocity, points) {
      var projected = y + velocity / 1000 * .998 / (1 - .998);
      return points.reduce(function (best, p) { return Math.abs(p - projected) < Math.abs(best - projected) ? p : best; }, points[0]);
    },
    step: function (y, velocity, target, dt) {
      // Exact critically damped spring; stable even when a frame is delayed.
      var omega = 22, offset = y - target, c = velocity + omega * offset, decay = Math.exp(-omega * dt);
      return { y: target + (offset + c * dt) * decay, v: (velocity - omega * c * dt) * decay };
    },
    theme: function (preference, dark) { return preference === 'light' || preference === 'dark' ? preference : dark ? 'dark' : 'light'; }
  };
})();
