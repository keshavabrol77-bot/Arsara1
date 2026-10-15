/* ARSARA money + shipping maths. Integer paise only.
   Shared by the browser (cart, shipping calculator) and the Node server (trusted validation). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArsaraMoney = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Format integer paise as Indian-rupee string. 39900 -> "₹399", 39950 -> "₹399.50" */
  function formatPaise(paise) {
    var neg = paise < 0;
    var p = Math.abs(Math.round(paise));
    var rupees = Math.floor(p / 100);
    var rem = p % 100;
    var s = String(rupees);
    // Indian digit grouping: last 3, then groups of 2
    if (s.length > 3) {
      var last3 = s.slice(-3);
      var rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      s = rest + ',' + last3;
    }
    if (rem) s += '.' + (rem < 10 ? '0' + rem : String(rem));
    return (neg ? '-' : '') + '₹' + s;
  }

  /**
   * lines: [{ unitPaise:int, qty:int }]
   * cfg:   { shippingFeePaise:int, freeThresholdPaise:int, discountPaise?:int }
   * The free-shipping threshold is tested on the merchandise subtotal AFTER discounts and BEFORE shipping.
   */
  function calculate(lines, cfg) {
    var subtotal = 0, count = 0;
    for (var i = 0; i < lines.length; i++) {
      var q = Math.max(0, Math.floor(lines[i].qty) || 0);
      subtotal += Math.round(lines[i].unitPaise) * q;
      count += q;
    }
    var discount = Math.min(Math.max(0, Math.floor(cfg.discountPaise || 0)), subtotal);
    var net = subtotal - discount;
    var qualifies = count > 0 && net >= cfg.freeThresholdPaise;
    var shipping = count === 0 ? 0 : (qualifies ? 0 : cfg.shippingFeePaise);
    var remaining = count === 0 ? cfg.freeThresholdPaise : Math.max(0, cfg.freeThresholdPaise - net);
    return {
      itemCount: count,
      subtotalPaise: subtotal,
      discountPaise: discount,
      merchandisePaise: net,
      shippingPaise: shipping,
      freeShipping: qualifies,
      remainingForFreePaise: remaining,
      totalPaise: net + shipping
    };
  }

  return { formatPaise: formatPaise, calculate: calculate };
});
