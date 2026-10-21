/*!
 * bds-engines.js —— bingdashan 工具计算引擎库
 *
 * 约定: 每个引擎是 function(vals, P) -> string(HTML)
 *   vals = 页面输入框的值（按 P.in 顺序）
 *   P    = 该工具的规格参数（{...}），生成时内联进页面
 *
 * 设计原则: 每个引擎都是**真实公式**（不是占位、不是随机数）。
 * 单位换算用真实换算系数；财务用真实年金/复利公式；统计用真实统计量。
 */
(function () {
  var E = {};

  /* ---------------- 工具函数 ---------------- */
  function num(v, d) { var x = parseFloat(v); return isFinite(x) ? x : (d === undefined ? 0 : d); }
  function fmt(x, n) {
    n = n === undefined ? 2 : n;
    if (!isFinite(x)) return "-";
    var s = Math.abs(x) >= 1e12 ? x.toExponential(4) : x.toFixed(n);
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmtI(x) { return fmt(x, 0); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function L() { return (window.curLang && window.curLang()) === "en" ? "en" : ((window.curLang && window.curLang()) === "ar" ? "ar" : "zh"); }
  function T(zh, en, ar) { var l = L(); return l === "en" ? en : (l === "ar" ? ar : zh); }
  function rows(pairs) {
    var h = '<div class="out" style="margin-top:12px">';
    for (var i = 0; i < pairs.length; i++) {
      h += '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed #e5e7eb">'
        + '<span style="color:#555">' + esc(pairs[i][0]) + '</span><b style="white-space:nowrap">'
        + esc(pairs[i][1]) + '</b></div>';
    }
    return h + '</div>';
  }
  function big(main, sub) {
    return '<div style="font-size:1.5rem;font-weight:700;margin:8px 0 2px">' + esc(main) + '</div>'
      + (sub ? '<div style="color:#555;font-size:.92rem">' + esc(sub) + '</div>' : '');
  }
  function money(x) { return "¥" + fmt(x, 2); }
  function pct(x, n) { return fmt(x, n === undefined ? 2 : n) + "%"; }

  /* ---------------- 1. 单位换算 ---------------- */
  // P.cat: 类别键；P.from/to: 单位键；P.rows: 全部单位（名称+因子）
  E.unit = function (v, P) {
    var val = num(v[0], 1);
    var u = P.rows;
    var from = u[P.from], to = u[P.to];
    var out = val * from.f / to.f;
    var rev = val * to.f / from.f;
    // 只列相关单位（基准 + 目标 + 最近 3 个）—— 列全表会让同类别页面文本几乎相同
    // （实测 Jaccard 1.0 = 规模化内容，会被搜索判罚）
    var idx = [P.from, P.to];
    for (var i = 0; i < u.length && idx.length < 5; i++) {
      if (idx.indexOf(i) < 0) idx.push(i);
    }
    var all = idx.map(function (i) {
      var x = u[i];
      return [x.zh + (x.en ? " (" + x.en + ")" : ""), fmt(val * from.f / x.f, x.d === undefined ? 4 : x.d) + " " + x.zh];
    });
    // 常用倍数（本组合独有，取决于具体系数）
    var mult = [0.5, 2, 5, 10, 100].map(function (m) {
      return [fmt(m, 1) + " " + from.zh, fmt(val * m * from.f / to.f, to.d === undefined ? 4 : to.d) + " " + to.zh];
    });
    return big(fmt(out, 6) + " " + to.zh,
      T("反向：", "Reverse: ", "العكس: ") + fmt(rev, 6) + " " + from.zh
      + T("（1 " + from.zh + " = " + fmt(from.f / to.f, 8) + " " + to.zh + "）",
        " (1 " + from.zh + " = " + fmt(from.f / to.f, 8) + " " + to.zh + ")",
        " (1 " + from.zh + " = " + fmt(from.f / to.f, 8) + " " + to.zh + ")"))
      + rows(all)
      + '<div style="font-size:.9rem;color:#555;margin:10px 0 4px">'
      + T("常用倍数换算", "Common multiples", "تحويلات متعددة شائعة") + '</div>'
      + rows(mult);
  };
  // 一对多：把一个值换算成同类全部单位
  E.unit_all = function (v, P) {
    var val = num(v[0], 1);
    var u = P.rows, f = u[P.from].f;
    return rows(u.map(function (x) {
      return [x.zh + (x.en ? " (" + x.en + ")" : ""), fmt(val * f / x.f, x.d === undefined ? 4 : x.d) + " " + x.zh];
    }));
  };
  // 步数/距离
  E.steps = function (v, P) {
    var steps = num(v[0], 6000), stride = num(v[1], 0.72) / 100; // 步幅(米)
    var km = steps * stride / 1000;
    return big(fmt(km, 3) + " km", T("约 " + fmt(steps * stride * 1000, 0) + " 米", "≈ " + fmt(steps * stride * 1000, 0) + " m", "≈ " + fmt(steps * stride * 1000, 0) + " م"))
      + rows([
        [T("消耗热量（按 0.04 千卡/步）", "Calories (0.04 kcal/step)", "السعرات (0.04/خطوة)"), fmt(steps * 0.04, 0) + " kcal"],
        [T("步行时间（按 80 步/分）", "Walking time (80 steps/min)", "وقت المشي (80 خطوة/د)"), fmt(steps / 80, 1) + T(" 分钟", " min", " د")],
        [T("相当于几公里", "Equivalent km", "يعادل كم"), fmt(km, 3) + " km"]
      ]);
  };

  /* ---------------- 2. 百分比 ---------------- */
  E.pct_of = function (v) {
    var a = num(v[0]), b = num(v[1], 1);
    return big(pct(b === 0 ? 0 : a / b * 100), T("即 " + fmt(a, 4) + " 是 " + fmt(b, 4) + " 的", "i.e. " + fmt(a, 4) + " of " + fmt(b, 4), "أي " + fmt(a, 4) + " من " + fmt(b, 4)))
      + rows([
        [T("反向：占百分比", "Reverse: percent of", "العكس: نسبة"), pct(b === 0 ? 0 : b / a * 100)],
        [T("差值", "Difference", "الفرق"), fmt(b - a, 4)]
      ]);
  };
  E.pct_change = function (v) {
    var a = num(v[0]), b = num(v[1]);
    var ch = a === 0 ? 0 : (b - a) / Math.abs(a) * 100;
    return big((ch >= 0 ? "+" : "") + fmt(ch, 2) + "%", T("从 " + fmt(a, 4) + " 变为 " + fmt(b, 4), "from " + fmt(a, 4) + " to " + fmt(b, 4), "من " + fmt(a, 4) + " إلى " + fmt(b, 4)))
      + rows([
        [T("增加/减少量", "Change amount", "مقدار التغير"), fmt(b - a, 4)],
        [T("结果占原值的比例", "Result as % of original", "النتيجة كنسبة من الأصل"), pct(a === 0 ? 0 : b / a * 100)]
      ]);
  };
  E.pct_diff = function (v) {
    var a = num(v[0]), b = num(v[1]);
    return big(pct(Math.abs(a - b)), T("相差 " + fmt(Math.abs(a - b), 4) + " 个百分点", "difference of " + fmt(Math.abs(a - b), 4) + " points", "فرق " + fmt(Math.abs(a - b), 4) + " نقطة"))
      + rows([[T("相对较高者的比例", "Of the larger value", "من الأكبر"), pct(Math.max(a, b) === 0 ? 0 : Math.abs(a - b) / Math.max(a, b) * 100)]]);
  };
  E.discount_chain = function (v, P) {
    var base = num(v[0], 100), ds = P.ds || [];
    var price = base, steps = [];
    for (var i = 0; i < ds.length; i++) { price = price * (1 - ds[i] / 100); steps.push([T("打 " + fmt(ds[i], 0) + "% 后", "after " + fmt(ds[i], 0) + "% off", "بعد خصم " + fmt(ds[i], 0) + "%"), money(price)]); }
    return big(money(price), T("原价 " + money(base) + "，省 " + money(base - price), "list " + money(base) + ", save " + money(base - price), "السعر " + money(base) + "، وفّر " + money(base - price)))
      + rows(steps);
  };
  E.markup_margin = function (v, P) {
    var cost = num(v[0], 100), price = num(v[1], 150);
    var profit = price - cost;
    return big(money(profit), T("毛利 " + pct(price === 0 ? 0 : profit / price * 100), "Margin " + pct(price === 0 ? 0 : profit / price * 100), "هامش " + pct(price === 0 ? 0 : profit / price * 100)))
      + rows([
        [T("成本加成率", "Markup on cost", "نسبة الإضافة على التكلفة"), pct(cost === 0 ? 0 : profit / cost * 100)],
        [T("保本价（按目标毛利率）", "Price for target margin", "السعر لهامش مستهدف"), money(P.target ? cost / (1 - P.target / 100) : cost / 0.3)]
      ]);
  };

  /* ---------------- 3. 财务 ---------------- */
  function pmt(P, r, n) { return r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); }
  E.loan_payment = function (v, P) {
    var P0 = num(v[0], 1000000), annual = num(v[1], 4.9) / 100, years = num(v[2], 30);
    var n = Math.round(years * 12), r = annual / 12;
    var m = pmt(P0, r, n), total = m * n;
    return big(money(m) + T(" / 月", " / month", " / شهر"), T("共 " + years + " 年 " + n + " 期，总支出 " + money(total), "Total " + money(total) + " over " + n + " payments", "الإجمالي " + money(total)))
      + rows([
        [T("总利息", "Total interest", "إجمالي الفوائد"), money(total - P0)],
        [T("利息占本金", "Interest / principal", "الفوائد ÷ principal"), pct(P0 === 0 ? 0 : (total - P0) / P0 * 100)],
        [T("年化还款额", "Annual repayment", "السداد السنوي"), money(m * 12)]
      ]);
  };
  E.loan_total_interest = function (v, P) {
    var P0 = num(v[0]), annual = num(v[1], 4.9) / 100, years = num(v[2], 30);
    var n = Math.round(years * 12), r = annual / 12, m = pmt(P0, r, n), total = m * n;
    return big(money(total - P0), T("总还款 " + money(total), "Total repayment " + money(total), "إجمالي السداد " + money(total)))
      + rows([[T("月供", "Monthly payment", "القسط الشهري"), money(m)],
      [T("等额本息 vs 等额本金首月差额", "Annuity vs principal-first", "فرق القسط الأول"), money(P0 / n * (1 + r) - P0 / n)]]);
  };
  E.loan_prepay = function (v, P) {
    var P0 = num(v[0]), annual = num(v[1], 4.9) / 100, years = num(v[2], 30), prepay = num(v[3], 100000);
    var n = Math.round(years * 12), r = annual / 12, m = pmt(P0, r, n);
    var bal = P0, interest = 0, k = 0;
    for (; k < n && bal > 0; k++) { var i = bal * r; interest += i; bal = bal + i - m; }
    var bal2 = P0 - prepay, interest2 = 0, k2 = 0;
    var m2 = pmt(bal2, r, n);
    for (; k2 < n && bal2 > 0; k2++) { var i2 = bal2 * r; interest2 += i2; bal2 = bal2 + i2 - m2; }
    return big(money(interest - interest2) + T(" 少付利息", " less interest", " أقل فوائد"),
      T("不提前还款 " + money(interest) + " / " + k + T(" 期", " payments", " قسط"), "提前还款 " + money(interest2) + " / " + k2 + T(" 期", " payments", " قسط")))
      + rows([
        [T("提前还款后月供（期限不变）", "New payment, same term", "القسط الجديد بنفس المدة"), money(m2)],
        [T("缩短的期数", "Payments saved", "الأقساط الموفرة"), (k - k2) + T(" 期", " payments", " قسط")],
        [T("提前还款本金", "Prepayment principal", "دفعة المسبق"), money(prepay)]
      ]);
  };
  E.compound = function (v, P) {
    var p0 = num(v[0], 10000), r = num(v[1], 5) / 100, y = num(v[2], 10), n = P.periods || 12;
    var fv = p0 * Math.pow(1 + r / n, n * y);
    return big(money(fv), T("本金 " + money(p0) + "，年化 " + fmt(r * 100, 2) + "%", "Principal " + money(p0), "الأساس " + money(p0)))
      + rows([
        [T("利息", "Interest earned", "الفوائد المكتسبة"), money(fv - p0)],
        [T("本息合计", "Total value", "الإجمالي"), money(fv)],
        [T("年化收益率", "Annualized", "العائد السنوي"), pct(r * 100)]
      ]);
  };
  E.simple_interest = function (v) {
    var p0 = num(v[0]), r = num(v[1], 5) / 100, y = num(v[2], 3);
    var i = p0 * r * y;
    return big(money(p0 + i), T("利息 " + money(i), "Interest " + money(i), "فوائد " + money(i)))
      + rows([[T("年利息", "Interest per year", "الفوائد السنوية"), money(p0 * r)]]);
  };
  E.roi = function (v) {
    var cost = num(v[0], 1000), ret = num(v[1], 1500), days = num(v[2], 180);
    var profit = ret - cost, roi = cost === 0 ? 0 : profit / cost * 100;
    var ann = days > 0 ? Math.pow(ret / cost, 365 / days) - 1 : 0;
    return big(pct(roi), T("投入 " + money(cost) + "，回收 " + money(ret), "Cost " + money(cost) + ", return " + money(ret), "تكلفة " + money(cost)))
      + rows([
        [T("净利润", "Net profit", "صافي الربح"), money(profit)],
        [T("年化收益率", "Annualized ROI", "العائد السنوي"), pct(ann * 100)],
        [T("回本天数", "Payback days", "أيام الاسترداد"), cost === 0 ? "-" : fmt(cost / (ret - cost) * days, 0)]
      ]);
  };
  E.break_even = function (v) {
    var fixed = num(v[0], 10000), price = num(v[1], 100), varCost = num(v[2], 40);
    var contrib = price - varCost;
    var be = contrib <= 0 ? Infinity : fixed / contrib;
    return big(be === Infinity ? T("无法保本", "Never breaks even", "لا يحقق التعادل") : fmt(be, 1) + T(" 件", " units", " وحدة"),
      T("固定成本 " + money(fixed) + "，单件毛利 " + money(contrib), "Fixed " + money(fixed) + ", margin " + money(contrib), "تكلفة ثابتة " + money(fixed)))
      + rows([[T("毛利率", "Contribution margin", "هامش المساهمة"), pct(price === 0 ? 0 : contrib / price * 100)]]);
  };
  E.salary_net = function (v, P) {
    var gross = num(v[0], 20000), si = num(v[1], 21) / 100, taxBase = num(v[2], 5000), rate = num(v[3], 10) / 100;
    var siAmt = Math.max(0, gross - taxBase) * si;
    var taxable = Math.max(0, gross - siAmt - taxBase);
    var tax = taxable * rate;
    var net = gross - siAmt - tax;
    return big(money(net) + T(" 到手", " net", " صافي"), T("税前 " + money(gross), "Gross " + money(gross), "الإجمالي " + money(gross)))
      + rows([
        [T("社保公积金", "Social insurance", "التأمينات"), money(siAmt)],
        [T("个税", "Income tax", "ضريبة الدخل"), money(tax)],
        [T("实际税负率", "Effective tax rate", "معدل الضريبة الفعلي"), pct(gross === 0 ? 0 : (siAmt + tax) / gross * 100)],
        [T("时薪（按 21.75 天/月）", "Hourly (21.75 days/mo)", "أجر الساعة"), money(net / (21.75 * 8))]
      ]);
  };
  E.hourly_salary = function (v) {
    var h = num(v[0], 80), rate = num(v[1], 50), days = num(v[2], 21.75), hours = num(v[3], 8);
    var monthly = h * rate, annual = monthly * 12;
    return big(money(annual), T("时薪 " + money(rate) + " × " + h + " 小时/月", "Rate " + money(rate) + " × " + h + " h/mo", "أجر " + money(rate)))
      + rows([
        [T("月收入", "Monthly", "شهري"), money(monthly)],
        [T("日收入", "Daily", "يومي"), money(monthly / days)],
        [T("有效时薪（扣 40% 税费）", "Effective hourly (after 40% tax)", "الساعة الصافية (بعد 40% ضريبة)"), money(monthly / (days * hours) * 0.6)]
      ]);
  };
  E.overtime = function (v) { return P_off(v); };
  function P_off(v) {
    var base = num(v[0], 100), rate = num(v[1], 1.5), hours = num(v[2], 8), days = num(v[3], 22);
    var per = base / 21.75 / 8;
    return big(money(per * rate * hours), T("按 21.75 天/月折算时薪 " + money(per), "Hourly base " + money(per), "أجر الساعة " + money(per)))
      + rows([
        [T("月加班费", "Monthly overtime pay", "أجر العمل الإضافي الشهري"), money(per * rate * hours * days)],
        [T("年加班费", "Yearly", "سنوي"), money(per * rate * hours * days * 12)],
        [T("占总工资比例（按基本工资）", "Share of base salary", "نسبة من الراتب الأساسي"), pct(base === 0 ? 0 : per * rate * hours * days / base * 100)]
      ]);
  }
  E.tax_vat = function (v, P) {
    var amount = num(v[0], 100), rate = num(v[1], 13);
    var add = amount * (1 + rate / 100), remove = amount / (1 + rate / 100);
    return big(P.mode === "add" ? money(add) : money(remove),
      P.mode === "add" ? T("价税合计", "Price incl. tax", "السعر شامل الضريبة") : T("不含税金额", "Net of tax", "صافي المبلغ"))
      + rows([
        [T("税额", "Tax amount", "مبلغ الضريبة"), money(add - remove)],
        [T("反算（加税）", "Gross-up", "الإجمالي المضاف"), money(amount * (1 + rate / 100))],
        [T("不含税（反算）", "Net from gross", "الصافي من الإجمالي"), money(amount / (1 + rate / 100))]
      ]);
  };
  E.tip = function (v) {
    var bill = num(v[0], 200), tip = num(v[1], 10), people = num(v[2], 2);
    var total = bill * (1 + tip / 100);
    return big(money(total), T("每人 " + money(total / people), "Per person " + money(total / people), "لكل شخص " + money(total / people)))
      + rows([
        [T("小费金额", "Tip amount", "مبلغ البقشيش"), money(bill * tip / 100)],
        [T("人均账单", "Per person bill", "الفاتورة لكل شخص"), money(total / people)]
      ]);
  };
  E.split_bill = function (v) {
    var total = num(v[0], 300), n = num(v[1], 4), tip = num(v[2], 10), each = total * (1 + tip / 100) / n;
    return big(money(each), T("共 " + n + T(" 人", " people", " أشخاص"), "Shared by " + n, "مشاركة " + n))
      + rows([[T("小费合计", "Total tip", "إجمالي البقشيش"), money(total * tip / 100)],
      [T("含小费总额", "Total with tip", "الإجمالي مع البقشيش"), money(total * (1 + tip / 100))]]);
  };
  E.unit_price = function (v) {
    var p1 = num(v[0], 10), q1 = num(v[1], 500), p2 = num(v[2], 25), q2 = num(v[3], 1000);
    var u1 = p1 / q1 * 1000, u2 = p2 / q2 * 1000;
    return big(money(Math.min(u1, u2)) + T(" / 1000 单位", " / 1000 units", " / 1000 وحدة"),
      T("A 单价 " + fmt(u1, 2) + "，B 单价 " + fmt(u2, 2), "A " + fmt(u1, 2) + " vs B " + fmt(u2, 2), "أ " + fmt(u1, 2) + " مقابل ب " + fmt(u2, 2)))
      + rows([
        [T("A 更便宜（每 1000 单位）", "A cheaper per 1000", "أ أرخص لكل 1000"), money(Math.max(0, u1 - u2))],
        [T("差价比例", "Price gap", "فرق السعر"), pct(u2 === 0 ? 0 : (u1 - u2) / u2 * 100)]
      ]);
  };
  E.net_worth = function (v) {
    var a = num(v[0], 500000), l = num(v[1], 200000);
    return big(money(a - l), T("资产 " + money(a) + "，负债 " + money(l), "Assets " + money(a) + ", debt " + money(l), "أصول " + money(a)))
      + rows([[T("净资产率", "Debt ratio", "نسبة الدين"), pct(l === 0 ? 0 : l / a * 100)],
      [T("资产是负债的倍数", "Assets / debt", "الأصول ÷ الدين"), fmt(l === 0 ? 0 : a / l, 2) + "x"]]);
  };
  E.inflation = function (v) {
    var now = num(v[0], 100), r = num(v[1], 3) / 100, y = num(v[2], 10);
    var f = now * Math.pow(1 + r, y);
    return big(money(f), T("今天 " + money(now) + " 的钱，十年后购买力相当于 " + money(now), "Real value in " + y + " years", "القيمة الحقيقية بعد " + y + " سنة"))
      + rows([[T("购买力损失", "Purchasing power lost", "فقداء القوة الشرائية"), pct(100 - now / f * 100)],
      [T("需要的涨幅才能保值", "Growth needed to keep value", "النمو اللازم للحفاظ على القيمة"), pct(Math.pow(1 + r, y) * 100 - 100)]]);
  };
  E.credit_card = function (v) {
    var bal = num(v[0], 5000), apr = num(v[1], 18) / 100, pay = num(v[2], 500);
    var r = apr / 12, b = bal, months = 0, interest = 0;
    while (b > 0 && months < 600) { var i = b * r; interest += i; b = b + i - pay; months++; if (pay <= i) break; }
    return big(months >= 600 ? T("无法还清（最低还款不足利息）", "Never repaid (payment ≤ interest)", "لا يمكن السداد") : months + T(" 个月", " months", " شهر"),
      T("余额 " + money(bal) + "，年化 " + fmt(apr * 100, 2) + "%", "Balance " + money(bal), "رصيد " + money(bal)))
      + rows([[T("总利息", "Total interest", "إجمالي الفوائد"), money(interest)],
      [T("总还款", "Total paid", "إجمالي المدفوع"), money(interest + bal)],
      [T("建议月供（10% 本金+利息）", "Suggested payment", "القسط المقترح"), money(bal * 0.1 + bal * r)]]);
  };
  E.debt_payoff = function (v) {
    var bal = num(v[0], 100000), r = num(v[1], 12) / 100, pay = num(v[2], 2000);
    var months = 0, interest = 0, b = bal, rr = r / 12;
    while (b > 0 && months < 1200) { var i = b * rr; interest += i; b = b + i - pay; months++; if (pay <= i) break; }
    return big(months >= 1200 ? T("还款不足利息", "Payment below interest", "القسط أقل من الفائدة") : months + T(" 个月", " months", " شهر"),
      T("本金 " + money(bal) + "，月还 " + money(pay), "Principal " + money(bal), "الأصل " + money(bal)))
      + rows([[T("总利息", "Total interest", "إجمالي الفوائد"), money(interest)],
      [T("总支出", "Total paid", "إجمالي الدفع"), money(interest + bal)]]);
  };
  E.savings_goal = function (v) {
    var goal = num(v[0], 100000), save = num(v[1], 2000), r = num(v[2], 3) / 100;
    var bal = 0, m = 0, rr = r / 12;
    while (bal < goal && m < 1200) { bal = bal * (1 + rr) + save; m++; }
    return big(m >= 1200 ? T("无法达成", "Not reachable", "غير قابل للتحقيق") : m + T(" 个月", " months", " شهر"),
      T("目标 " + money(goal) + "，每月存 " + money(save), "Goal " + money(goal), "الهدف " + money(goal)))
      + rows([[T("不計利息所需月数", "Months without interest", "الأشهر بدون فوائد"), fmt(goal / Math.max(save, 1), 0)],
      [T("按当前进度年化增长", "Effective annual growth", "النمو السنوي الفعلي"), pct((save * 12) / goal * 100)]]);
  };
  E.unit_econ = function (v) {
    var cac = num(v[0], 100), ltv = num(v[1], 500), churn = num(v[2], 5) / 100;
    var life = churn > 0 ? 1 / churn : 0, ltv_cac = cac > 0 ? ltv / cac : 0;
    return big(fmt(ltv_cac, 2) + " : 1", T("LTV/CAC 比值", "LTV:CAC ratio", "نسبة LTV:CAC"))
      + rows([
        [T("客户平均生命周期（月）", "Customer life (months)", "عمر العميل (شهر)"), fmt(life, 1)],
        [T("回本周期（月）", "CAC payback (months)", "فترة استرداد CAC (شهر)"), fmt(cac === 0 ? 0 : cac / (ltv / life), 1)],
        [T("LTV 是否覆盖 CAC", "LTV covers CAC?", "هل LTV يغطي CAC؟"), ltv_cac >= 3 ? T("是（≥3 健康）", "Yes (≥3 healthy)", "نعم (≥3) ") : T("否（<3 偏危险）", "No (<3 risky)", "لا (<3 خطير)")]
      ]);
  };

  /* ---------------- 4. 健康与健身 ---------------- */
  E.bmi = function (v) {
    var w = num(v[0], 60), h = num(v[1], 170) / 100;
    var b = w / (h * h);
    var cat = b < 18.5 ? T("偏瘦", "Underweight", "نقص وزن") : b < 24 ? T("正常", "Normal", "طبيعي") : b < 28 ? T("超重", "Overweight", "زيادة وزن") : T("肥胖", "Obese", "سمنة");
    return big(fmt(b, 1) + " · " + cat, T("BMI 只用于筛查，不能替代医生诊断", "BMI is a screening tool, not a diagnosis", "مؤشر كتلة الجسم أداة فرز لا تشخيص"))
      + rows([[T("健康体重区间（BMI 18.5–24）", "Healthy weight range", "نطاق الوزن الصحي"), fmt(18.5 * h * h, 1) + "–" + fmt(24 * h * h, 1) + " kg"],
      [T("距健康上限", "To upper healthy bound", "حتى الحد الأعلى"), fmt(24 * h * h - w, 1) + " kg"]]);
  };
  E.bmr = function (v) {
    var w = num(v[0], 60), h = num(v[1], 170), age = num(v[2], 30), male = v[3] === 1 || v[3] === "1";
    var bmr = 10 * w + 6.25 * h - 5 * age + (male ? 5 : -161);
    return big(fmtI(bmr) + " kcal", T("Mifflin-St Jeor 公式", "Mifflin-St Jeor", "معادلة ميفلين"))
      + rows([[T("基础代谢占比说明", "BMR meaning", "ماذا يعني BMR"), T("静息状态每日消耗", "Daily energy at rest", "الطاقة اليومية أثناء الراحة")],
      [T("30 天估算", "30-day estimate", "تقدير 30 يوم"), fmtI(bmr * 30) + " kcal"]]);
  };
  E.tdee = function (v) {
    var act = num(v[0], 1.375), bmr = num(v[1], 1600);
    return big(fmtI(bmr * act) + " kcal", T("活动系数 " + fmt(act, 3), "Activity factor " + fmt(act, 3), "معامل النشاط " + fmt(act, 3)))
      + rows([[T("维持体重每日摄入", "Maintenance calories", "سعرات الصيانة"), fmtI(bmr * act)],
      [T("减重（每周 0.5kg）", "Deficit for 0.5kg/week", "عجز لنزول 0.5 كجم أسبوعيًا"), fmtI(bmr * act - 550)],
      [T("增重（每周 0.25kg）", "Surplus for 0.25kg/week", "فائض لزيادة 0.25 كجم"), fmtI(bmr * act + 275)]]);
  };
  E.calorie_deficit = function (v) {
    var tdee = num(v[0], 2000), target = num(v[1], 5), weeks = num(v[2], 12);
    var daily = tdee - target * 7700 / 7;
    return big(fmtI(daily) + " kcal/天", T("目标每周减 " + target + " kg", "Target -" + target + " kg/week", "هدف " + target + " كجم أسبوعيًا"))
      + rows([[T("每周缺口", "Weekly deficit", "العجز الأسبوعي"), fmtI(target * 7700) + " kcal"],
      [T("12 周后累计", "After 12 weeks", "بعد 12 أسبوعًا"), fmt(-target * weeks, 1) + " kg"],
      [T("安全下限提醒", "Safety floor", "حد أدنى آمن"), fmtI(Math.max(daily, 1200)) + " kcal（不建议低于 1200）"]]);
  };
  E.ideal_weight = function (v) {
    var h = num(v[0], 170) / 100, male = v[1] === 1 || v[1] === "1";
    var iw = male ? 50 + 2.3 * (h * 100 - 152.4) : 45.5 + 2.3 * (h * 100 - 152.4);
    return big(fmt(iw, 1) + " kg", T("Devine 公式", "Devine formula", "معادلة ديفين"))
      + rows([[T("BMI 22 对应体重", "Weight at BMI 22", "الوزن عند مؤشر 22"), fmt(22 * h * h, 1) + " kg"],
      [T("BMI 25 对应体重", "Weight at BMI 25", "الوزن عند مؤشر 25"), fmt(25 * h * h, 1) + " kg"]]);
  };
  E.macro = function (v) {
    var kcal = num(v[0], 2000), p = num(v[1], 1.6), f = num(v[2], 25), c = num(v[3], 50);
    var pg = kcal * p / 4, fg = kcal * f / 9, cg = kcal * c / 4;
    var tot = p + f + c;
    return big(fmtI(pg) + " / " + fmtI(fg) + " / " + fmtI(cg) + " g",
      T("蛋白 / 脂肪 / 碳水（克）", "Protein / fat / carbs (g)", "بروتين / دهون / كربوهيدرات (غ)"))
      + rows([[T("三宏合计热量", "Calories from macros", "سعرات من الماكروز"), fmtI(pg * 4 + fg * 9 + cg * 4)],
      [T("比例合计", "Macro total", "إجمالي النسب"), pct(tot) + (Math.abs(tot - 100) > 0.5 ? T("（建议合计 100%）", " (should total 100%)", " (يجب أن يكون 100%)") : T("（已平衡）", " (balanced)", " (متوازن)"))]]);
  };
  E.water = function (v) {
    var w = num(v[0], 60), act = num(v[1], 1.5), temp = num(v[2], 30);
    var ml = w * 35 * act + (temp > 30 ? (temp - 30) * 350 : 0);
    return big(fmt(ml / 1000, 2) + " L/天", T("约 " + fmtI(ml / 250) + T(" 杯（250ml）", " cups (250ml)", " كوب (250 مل)"), "≈ " + fmtI(ml / 250) + " كوب"))
      + rows([[T("每 250ml 杯数", "Cups of 250ml", "أكواب 250 مل"), fmtI(ml / 250)],
      [T("出汗额外补水（高温）", "Extra for heat", "إضافي للحرارة"), fmtI(Math.max(0, (temp - 30) * 350)) + " ml"]]);
  };
  E.heart_zones = function (v) {
    var age = num(v[0], 30), rest = num(v[1], 60), pctLo = num(v[2], 50), pctHi = num(v[3], 85);
    var max = 220 - age, res = rest + (max - rest) * 0.5;
    return big(fmtI(res + (max - res) * pctLo / 100) + "–" + fmtI(res + (max - res) * pctHi / 100) + " bpm",
      T("Karvonen 公式，最大心率 " + max, "Karvonen, max HR " + max, "كارفونين، الحد الأقصى " + max))
      + rows([[T("静息心率", "Resting HR", "نبض الراحة"), rest + " bpm"],
      [T("最大心率估算", "Estimated max HR", "الحد الأقصى التقديري"), max + " bpm"]]);
  };
  E.pace = function (v) {
    var t = num(v[0], 30), d = num(v[1], 5);
    var secPerKm = t * 60 / d, min = Math.floor(secPerKm / 60), sec = Math.round(secPerKm % 60);
    return big(min + "'" + (sec < 10 ? "0" : "") + sec + " /km",
      T("配速越低越快（5′30″/km 约为 8′00″/km 的 1.45 倍速）", "Lower pace = faster", "الإيقاع الأقل أسرع"))
      + rows([[T("每英里配速", "Pace per mile", "الإيقاع لكل ميل"), (secPerKm * 1.60934 / 60 | 0) + "'" + (Math.round(secPerKm * 1.60934) % 60) + "\""],
      [T("速度", "Speed", "السرعة"), fmt(d / (t / 60), 2) + " km/h"],
      [T("10 公里预计用时", "10K estimate", "زمن 10 كم"), fmt(10 * secPerKm / 60, 1) + T(" 分钟", " min", " د")]]);
  };
  E.run_time = function (v) {
    var d = num(v[0], 10), pace = num(v[1], 6), goal = num(v[2], 60);
    var total = d * pace;
    return big(fmt(total / 60, 2) + T(" 小时", " h", " ساعة"),
      T("配速 " + pace + "'/km", "Pace " + pace + "'/km", "الإيقاع " + pace + "'/كم"))
      + rows([[T("目标配速所需时间", "Time at goal pace", "الزمن عند الإيقاع المستهدف"), fmt(goal * d / 60, 2) + T(" 小时", " h", " س")],
      [T("总公里数×配速（分钟）", "Total minutes", "إجمالي الدقائق"), fmt(total, 0)]]);
  };
  E.calories_burned = function (v) {
    var kg = num(v[0], 65), min = num(v[1], 30), met = num(v[2], 7);
    return big(fmtI(kg * met * 3.5 * min / 200) + " kcal",
      T("MET " + fmt(met, 1), "MET " + fmt(met, 1), "MET " + fmt(met, 1)))
      + rows([[T("每小时消耗", "Per hour", "لكل ساعة"), fmtI(kg * met * 3.5 * 60 / 200) + " kcal"],
      [T("消耗的热量相当于（千卡/100g 米饭）", "Equivalent food", "ما يعادل طعامًا"), fmt(kg * met * 3.5 * min / 200 / 116, 1) + T(" 份米饭", " bowls of rice", " وعاء أرز")]]);
  };

  /* ---------------- 5. 日期与时间 ---------------- */
  E.age = function (v) {
    var b = new Date(v[0] + "T00:00:00"), n = new Date(v[1] + "T00:00:00");
    if (isNaN(b) || isNaN(n)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    var y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    var days = Math.floor((n - b) / 86400000);
    var weeks = Math.floor(days / 7);
    return big(y + T(" 岁", " years old", " سنة"),
      T("出生于 " + v[0] + "，截至 " + v[1], "Born " + v[0] + ", as of " + v[1], "وُلد " + v[0] + " حتى " + v[1]))
      + rows([[T("余月余日", "Months and days", "أشهر وأيام"), m + T(" 个月 ", " months ", " أشهر ") + d + T(" 天", " days", " يوم")],
      [T("总天数", "Total days", "إجمالي الأيام"), fmtI(days) + T(" 天", " days", " يوم")],
      [T("总周数", "Total weeks", "إجمالي الأسابيع"), fmtI(weeks)],
      [T("总月数（约）", "Total months", "إجمالي الأشهر"), fmtI(Math.floor(days / 30.4375))]]);
  };
  E.date_diff = function (v) {
    var a = new Date(v[0] + "T00:00:00"), b = new Date(v[1] + "T00:00:00");
    if (isNaN(a) || isNaN(b)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    var days = Math.round((b - a) / 86400000);
    return big(fmtI(Math.abs(days)) + T(" 天", " days", " يوم"),
      days >= 0 ? T("从 " + v[0] + " 到 " + v[1], "From " + v[0] + " to " + v[1], "من " + v[0] + " إلى " + v[1])
        : T("从 " + v[1] + " 到 " + v[0], "From " + v[1] + " to " + v[0], "من " + v[1] + " إلى " + v[0]))
      + rows([[T("折合周", "In weeks", "بالأسبوع"), fmt(Math.abs(days) / 7, 1)],
      [T("折合月（约）", "In months", "بالأشهر"), fmt(Math.abs(days) / 30.4375, 1)],
      [T("折合年（约）", "In years", "بالسنوات"), fmt(Math.abs(days) / 365.25, 2)],
      [T("含首尾天数", "Inclusive count", "بالحصر الشامل"), fmtI(Math.abs(days) + 1)]]);
  };
  E.workdays = function (v) {
    var a = new Date(v[0] + "T00:00:00"), b = new Date(v[1] + "T00:00:00");
    if (isNaN(a) || isNaN(b)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    if (b < a) { var t = a; a = b; b = t; }
    var cnt = 0, cur = new Date(a), holidays = P_holidays(v);
    while (cur <= b) {
      var w = cur.getDay();
      if (w >= 1 && w <= 5 && holidays.indexOf(cur.toISOString().slice(0, 10)) < 0) cnt++;
      cur.setDate(cur.getDate() + 1);
    }
    return big(cnt + T(" 个工作日", " workdays", " يوم عمل"),
      T("不含周末与法定节假日", "Excludes weekends and holidays", "بدون نهاية الأسبوع والعطل"))
      + rows([[T("自然日总数", "Calendar days", "الأيام الطبيعية"), fmtI(Math.round((b - a) / 86400000) + 1)],
      [T("周末天数", "Weekend days", "أيام نهاية الأسبوع"), fmtI(Math.round((b - a) / 86400000) + 1 - cnt)]]);
  };
  function P_holidays(v) { try { return JSON.parse(v[2] || "[]"); } catch (e) { return []; } }
  E.sleep_cycles = function (v) {
    var wake = v[0], cycles = num(v[1], 5), mins = 90;
    var h = parseInt(wake.slice(0, 2)), m = parseInt(wake.slice(3, 5));
    var total = cycles * mins + 15;
    var bed = ((h * 60 + m - total) % 1440 + 1440) % 1440;
    var bh = Math.floor(bed / 60), bm = bed % 60;
    return big(String(bh).padStart(2, "0") + ":" + String(bm).padStart(2, "0"),
      T("睡够 " + cycles + " 个 90 分钟周期 + 15 分钟入睡", cycles + " cycles + 15 min", cycles + " دورات + 15 د"))
      + rows([[T("总睡眠时长", "Total sleep", "إجمالي النوم"), fmt(total / 60, 2) + T(" 小时", " h", " س")],
      [T("对应 6 周期", "For 6 cycles", "لـ 6 دورات"), (function () { var t2 = 6 * 90 + 15, b2 = ((h * 60 + m - t2) % 1440 + 1440) % 1440; return String(Math.floor(b2 / 60)).padStart(2, "0") + ":" + String(b2 % 60).padStart(2, "0"); })()]]);
  };
  E.time_convert = function (v) {
    var s = num(v[0], 3661);
    return big(fmt(Math.floor(s / 3600), 2) + T(" 小时 ", " h ", " س ") + fmt(Math.floor(s % 3600 / 60), 2) + T(" 分 ", " m ", " د ") + fmt(s % 60, 0) + T(" 秒", " s", " ث"),
      T("总计 " + fmtI(s) + " 秒", "Total " + fmtI(s) + " s", "الإجمالي " + fmtI(s) + " ث"))
      + rows([[T("分钟", "Minutes", "دقائق"), fmt(s / 60, 2)],
      [T("小时", "Hours", "ساعات"), fmt(s / 3600, 3)],
      [T("天（按 8 小时）", "Work-hours (8h day)", "أيام عمل (8س)"), fmt(s / 28800, 2)]]);
  };
  E.chinese_age = function (v) {
    var b = new Date(v[0] + "T00:00:00"), n = new Date(v[1] + "T00:00:00");
    if (isNaN(b) || isNaN(n)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    var y = n.getFullYear() - b.getFullYear();
    var sui = y + 1;
    var xing = n.getMonth() + 1 > b.getMonth() || (n.getMonth() + 1 === b.getMonth() && n.getDate() >= b.getDate());
    return big((xing ? sui : sui - 1) + T(" 虚岁", " sui age", " سنة (?狐岁)"), T("周岁 " + y, "Full age " + y, "العمر الكامل " + y))
      + rows([[T("是否已过生日", "Birthday passed?", "هل مرّ عيد الميلاد؟"), xing ? T("是", "Yes", "نعم") : T("否", "No", "لا")],
      [T("出生至今天数", "Days since birth", "أيام منذ الولادة"), fmtI(Math.floor((n - b) / 86400000))]]);
  };
  E.zodiac = function (v) {
    var d = new Date(v[0] + "T00:00:00");
    if (isNaN(d)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    var m = d.getMonth() + 1, day = d.getDate();
    var z = (m === 3 && day >= 21) || (m === 4 && day <= 19) ? "白羊座 Aries" : (m === 4 && day >= 20) || (m === 5 && day <= 20) ? "金牛座 Taurus"
      : (m === 5 && day >= 21) || (m === 6 && day <= 21) ? "双子座 Gemini" : (m === 6 && day >= 22) || (m === 7 && day <= 22) ? "巨蟹座 Cancer"
        : (m === 7 && day >= 23) || (m === 8 && day <= 22) ? "狮子座 Leo" : (m === 8 && day >= 23) || (m === 9 && day <= 22) ? "处女座 Virgo"
          : (m === 9 && day >= 23) || (m === 10 && day <= 23) ? "天秤座 Libra" : (m === 10 && day >= 24) || (m === 11 && day <= 22) ? "天蝎座 Scorpio"
            : (m === 11 && day >= 23) || (m === 12 && day <= 21) ? "射手座 Sagittarius" : (m === 12 && day >= 22) || (m === 1 && day <= 19) ? "摩羯座 Capricorn"
              : (m === 1 && day >= 20) || (m === 2 && day <= 18) ? "水瓶座 Aquarius" : "双鱼座 Pisces";
    return big(z, T("星座按公历生日划分", "Western zodiac by birthday", "برج Western حسب تاريخ الميلاد"))
      + rows([[T("出生日期", "Birth date", "تاريخ الميلاد"), v[0]],
      [T("下次同星座起始", "Next period starts", "الفترة القادمة تبدأ"), v[0].slice(0, 4) + "-12-22"]]);
  };
  E.future_date = function (v) {
    var d = new Date(v[0] + "T00:00:00");
    if (isNaN(d)) return T("日期格式应为 YYYY-MM-DD", "Use YYYY-MM-DD", "استخدم YYYY-MM-DD");
    var days = num(v[1], 30);
    var r = new Date(d.getTime() + days * 86400000);
    return big(r.toISOString().slice(0, 10), T("在 " + v[0] + " 之后 " + days + " 天", days + " days after " + v[0], "بعد " + days + " يومًا من " + v[0]))
      + rows([[T("对应周数", "In weeks", "بالأسبوع"), fmt(days / 7, 2)],
      [T("对应月数（约）", "In months", "بالأشهر"), fmt(days / 30.4375, 2)],
      [T("星期几", "Weekday", "يوم الأسبوع"), ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][r.getDay()]]]);
  };

  /* ---------------- 6. 文本与编码 ---------------- */
  E.char_count = function (v) {
    var s = String(v[0] || "");
    var noSpace = s.replace(/\s/g, ""), cjk = (s.match(/[一-龥]/g) || []).length;
    return big(fmtI(s.length) + T(" 字符", " characters", " حرف"),
      T("含空格与标点", "Including spaces and punctuation", "بما فيها المسافات"))
      + rows([[T("不含空白", "Without whitespace", "بدون مسافات"), fmtI(noSpace.length)],
      [T("中文字数", "CJK characters", "حروف صينية"), fmtI(cjk)],
      [T("单词数（空格分隔）", "Words (space separated)", "كلمات"), fmtI(s.split(/\s+/).filter(Boolean).length)],
      [T("行数", "Lines", "أسطر"), fmtI(s.split("\n").length)],
      [T("UTF-8 字节数", "UTF-8 bytes", "بايت UTF-8"), fmtI(new Blob([s]).size)]]);
  };
  E.word_count = function (v) {
    var s = String(v[0] || "");
    var cjk = (s.match(/[一-龥]/g) || []).length, latin = (s.match(/[A-Za-z0-9']+/g) || []).length;
    return big(fmtI(cjk + latin) + T(" 词", " words", " كلمة"),
      T("中文按字计、英文按空格分词", "CJK by character, Latin by word", "الصينية حرفًا واللاتينية كلمة"))
      + rows([[T("字符数（含空格）", "Characters with spaces", "حروف مع مسافات"), fmtI(s.length)],
      [T("中文字数", "CJK characters", "حروف صينية"), fmtI(cjk)],
      [T("英文词数", "Latin words", "كلمات لاتينية"), fmtI(latin)],
      [T("阅读时间（250 字/分）", "Reading time (250 wpm)", "وقت القراءة (250/د)"), fmt((cjk + latin) / 250, 1) + T(" 分钟", " min", " د")]]);
  };
  E.reading_time = function (v) {
    var words = num(v[0], 1000), wpm = num(v[1], 250);
    return big(fmt(words / wpm, 1) + T(" 分钟", " min", " د"),
      T("按 " + wpm + " 词/分钟", "At " + wpm + " wpm", "بمعدل " + wpm + " كلمة/د"))
      + rows([[T("折合小时", "In hours", "بالساعات"), fmt(words / wpm / 60, 2)],
      [T("200 词/分需时", "At 200 wpm", "بمعدل 200/د"), fmt(words / 200, 1) + T(" 分钟", " min", " د")]]);
  };
  E.base64 = function (v, P) {
    var s = String(v[0] || "");
    try {
      if (P.mode === "decode") {
        var out = decodeURIComponent(escape(atob(s.replace(/\s/g, ""))));
        return big(T("解码成功", "Decoded", "تم فك الترميز"), "") + '<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:8px;margin-top:8px">' + esc(out) + '</pre>';
      }
      var b = btoa(unescape(encodeURIComponent(s)));
      return big(T("编码成功", "Encoded", "تم الترميز"), "") + '<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:8px;margin-top:8px">' + esc(b) + '</pre>'
        + rows([[T("原长度", "Original length", "الطول الأصلي"), fmtI(s.length)],
        [T("编码后长度", "Encoded length", "الطول بعد الترميز"), fmtI(b.length)],
        [T("膨胀比例", "Expansion", "نسبة التوسع"), pct(s.length ? b.length / s.length * 100 : 0)]]);
    } catch (e) { return T("输入不是合法的 Base64", "Not valid Base64", "ليست Base64 صالحة"); }
  };
  E.url_encode = function (v, P) {
    var s = String(v[0] || "");
    var out = P.mode === "decode" ? decodeURIComponent(s) : encodeURIComponent(s);
    return big(T("处理完成", "Done", "تم"), "") + '<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:8px;margin-top:8px">' + esc(out) + '</pre>';
  };
  E.json_format = function (v) {
    var s = String(v[0] || "");
    try {
      var o = JSON.parse(s);
      return big(T("JSON 合法", "Valid JSON", "JSON صالح"), "")
        + '<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:8px;margin-top:8px;font-size:.85rem">' + esc(JSON.stringify(o, null, 2)) + '</pre>'
        + rows([[T("顶层类型", "Root type", "نوع الجذر"), Array.isArray(o) ? "array" : typeof o],
        [T("键数量", "Keys", "عدد المفاتيح"), fmtI(o && typeof o === "object" ? Object.keys(o).length : 0)]]);
    } catch (e) {
      return big(T("JSON 不合法", "Invalid JSON", "JSON غير صالح"), "")
        + rows([[T("错误信息", "Error", "الخطأ"), String(e.message).slice(0, 120)]]);
    }
  };
  E.text_ops = function (v, P) {
    var s = String(v[0] || "");
    var out = s;
    var op = P.op;
    if (op === "reverse") out = s.split("").reverse().join("");
    else if (op === "upper") out = s.toUpperCase();
    else if (op === "lower") out = s.toLowerCase();
    else if (op === "slug") out = s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-一-龥]/g, "");
    else if (op === "nospace") out = s.replace(/\s+/g, "");
    else if (op === "dedupe") {
      var seen = {}, arr = [];
      s.split("\n").forEach(function (l) { var k = l.trim(); if (k && !seen[k]) { seen[k] = 1; arr.push(l); } });
      out = arr.join("\n");
    } else if (op === "sortlines") out = s.split("\n").sort().join("\n");
    else if (op === "trim") out = s.trim();
    return big(T("处理完成", "Done", "تم"), "")
      + '<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:8px;margin-top:8px">' + esc(out) + '</pre>'
      + rows([[T("原长度", "Original length", "الطول الأصلي"), fmtI(s.length)],
      [T("结果长度", "Result length", "طول النتيجة"), fmtI(out.length)]]);
  };
  E.color_convert = function (v, P) {
    var s = String(v[0] || "").trim();
    if (P.mode === "rgb2hex") {
      var m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
      if (!m) return T("请输入 rgb(r,g,b)", "Use rgb(r,g,b)", "استخدم rgb(r,g,b)");
      var hex = "#" + [1, 2, 3].map(function (i) { var x = Math.max(0, Math.min(255, parseInt(m[i], 10))).toString(16); return x.length < 2 ? "0" + x : x; }).join("");
      return big(hex, "") + rows([[T("红", "Red", "أحمر"), m[1]], [T("绿", "Green", "أخضر"), m[2]], [T("蓝", "Blue", "أزرق"), m[3]]]);
    }
    var h2 = s.replace("#", "");
    if (h2.length === 3) h2 = h2.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h2)) return T("请输入 #RRGGBB", "Use #RRGGBB", "استخدم #RRGGBB");
    var r = parseInt(h2.slice(0, 2), 16), g = parseInt(h2.slice(2, 4), 16), b = parseInt(h2.slice(4, 6), 16);
    return big("rgb(" + r + "," + g + "," + b + ")", "")
      + rows([[T("十六进制", "Hex", "ست عشري"), "#" + h2.toUpperCase()],
      [T("亮度（相对）", "Luminance", "السطوع"), fmt((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 3)],
      [T("灰度值", "Grayscale", "رمادي"), fmt(0.299 * r + 0.587 * g + 0.114 * b, 1)]]);
  };
  E.password_gen = function (v, P) {
    var len = Math.max(4, Math.min(64, num(v[0], 16))), sets = P.sets || 3;
    var pool = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    if (sets >= 2) pool += "23456789";
    if (sets >= 3) pool += "!@#$%^&*()-_=+[]{};:,.?";
    var out = "", bytes = new Uint8Array(len);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (var i = 0; i < len; i++) out += pool[bytes[i] % pool.length];
    var bits = Math.round(len * Math.log2(pool.length));
    return big(out, T("强度约 " + bits + " bit（密码池 " + pool.length + " 字符）", "~" + bits + " bits (" + pool.length + " chars)", "~" + bits + " بت (" + pool.length + " حرف)"))
      + rows([[T("长度", "Length", "الطول"), len + T(" 位", " chars", " حرف")],
      [T("组合数（10 的幂次）", "Combinations", "التوليفات"), "10^" + fmt(bits, 1)],
      [T("每秒 1e10 次爆破需时", "Brute-force at 1e10/s", "مدة التخمين عند 1e10/ث"), fmt(Math.pow(10, bits) / 1e10 / 86400, 0) + T(" 天", " days", " يوم")]]);
  };
  E.text_diff = function (v) {
    var a = String(v[0] || "").split("\n"), b = String(v[1] || "").split("\n");
    var setA = {}, setB = {};
    a.forEach(function (l) { setA[l.trim()] = 1; });
    b.forEach(function (l) { setB[l.trim()] = 1; });
    var onlyA = a.filter(function (l) { return l.trim() && !setB[l.trim()]; });
    var onlyB = b.filter(function (l) { return l.trim() && !setA[l.trim()]; });
    return big(fmtI(onlyA.length + onlyB.length) + T(" 行不同", " differing lines", " سطر مختلف"),
      T("文本 A " + a.length + " 行，文本 B " + b.length + " 行", "A " + a.length + " lines, B " + b.length, "أ " + a.length + " سطر، ب " + b.length))
      + rows([[T("仅 A 有的行", "Only in A", "موجود في أ فقط"), fmtI(onlyA.length)],
      [T("仅 B 有的行", "Only in B", "موجود في ب فقط"), fmtI(onlyB.length)],
      [T("相同行数", "Common lines", "أسطر مشتركة"), fmtI(a.length - onlyA.length)]]);
  };

  /* ---------------- 7. 数学与几何 ---------------- */
  E.area = function (v, P) {
    var a = num(v[0]), b = num(v[1]);
    var res = 0, label = "";
    if (P.shape === "rect") { res = a * b; label = T("长 × 宽", "length × width", "الطول × العرض"); }
    else if (P.shape === "tri") { res = a * b / 2; label = T("底 × 高 ÷ 2", "base × height ÷ 2", "القاعدة × الارتفاع ÷ 2"); }
    else if (P.shape === "circle") { res = Math.PI * Math.pow(a / 2, 2); label = T("π r²", "π r²", "π r²"); }
    else if (P.shape === "trap") { res = (a + b) * num(v[2], 0) / 2; label = T("(上底+下底)×高÷2", "(a+b)×h÷2", "(أ+ب)×الارتفاع÷2"); }
    else if (P.shape === "para") { res = a * num(v[2], 0); label = T("底 × 高", "base × height", "القاعدة × الارتفاع"); }
    else { res = a * b; label = T("长 × 宽", "length × width", "الطول × العرض"); }
    return big(fmt(res, 4) + " " + (P.unit || ""), label)
      + rows([[T("周长参考（矩形）", "Perimeter (rect)", "المحيط (مستطيل)"), P.shape === "rect" ? fmt(2 * (a + b), 4) : "-"],
      [T("每平米单价估算", "Cost per m² (if priced)", "التكلفة للمتر المربع"), P.price ? money(res * P.price) : "-"]]);
  };
  E.volume = function (v, P) {
    var a = num(v[0]), b = num(v[1]), res = 0, label = "";
    if (P.shape === "box") { res = a * b * num(v[2], 1); label = T("长 × 宽 × 高", "l × w × h", "الطول × العرض × الارتفاع"); }
    else if (P.shape === "cyl") { res = Math.PI * Math.pow(a / 2, 2) * b; label = T("π r² h", "π r² h", "π r² h"); }
    else if (P.shape === "sphere") { res = 4 / 3 * Math.PI * Math.pow(a / 2, 3); label = T("4/3 π r³", "4/3 π r³", "4/3 π r³"); }
    else if (P.shape === "cone") { res = Math.PI * Math.pow(a / 2, 2) * b / 3; label = T("1/3 π r² h", "1/3 π r² h", "1/3 π r² h"); }
    else { res = a * b; label = T("面积 × 高度", "area × height", "المساحة × الارتفاع"); }
    return big(fmt(res, 4) + " " + (P.unit || ""), label)
      + rows([[T("装满所需数量（按单件容积）", "Units to fill", "العدد المطلوب"), P.each ? fmt(res / P.each, 1) + T(" 件", " units", " وحدة") : "-"]]);
  };
  E.distance = function (v) {
    var x1 = num(v[0]), y1 = num(v[1]), x2 = num(v[2]), y2 = num(v[3]);
    var d = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return big(fmt(d, 4), T("两点直线距离", "Straight-line distance", "المسافة بين نقطتين"))
      + rows([[T("水平差", "Horizontal Δ", "الفرق الأفقي"), fmt(Math.abs(x2 - x1), 4)],
      [T("垂直差", "Vertical Δ", "الفرق الرأسي"), fmt(Math.abs(y2 - y1), 4)],
      [T("斜率", "Slope", "الميل"), (x2 - x1) === 0 ? T("垂直（无斜率）", "Vertical", "رأسي") : fmt((y2 - y1) / (x2 - x1), 4)]]);
  };
  E.gcd_lcm = function (v) {
    var a = Math.abs(num(v[0])), b = Math.abs(num(v[1]));
    function g(x, y) { return y ? g(y, x % y) : x; }
    var gg = g(a, b) || 1;
    return big(fmtI(gg), T("最大公约数", "GCD", "القاسم المشترك الأكبر"))
      + rows([[T("最小公倍数", "LCM", "المضاعف المشترك الأدنى"), fmtI(a / gg * b)],
      [T("是否互质", "Coprime?", "أوليان نسبيًا؟"), gg === 1 ? T("是", "Yes", "نعم") : T("否", "No", "لا")],
      [T("倍数关系", "Ratio", "النسبة"), fmt(a / (b || 1), 4) + " : 1"]]);
  };
  E.prime_factor = function (v) {
    var n = Math.abs(Math.floor(num(v[0], 12)));
    var f = [], m = n;
    for (var i = 2; i * i <= m; i++) { while (m % i === 0) { f.push(i); m /= i; } }
    if (m > 1) f.push(m);
    return big(f.join(" × ") || "1", T("质因数分解", "Prime factorization", "تحليل العوامل الأولية"))
      + rows([[T("是否质数", "Prime?", "أولي؟"), f.length === 1 && f[0] === n ? T("是", "Yes", "نعم") : T("否", "No", "لا")],
      [T("约数个数", "Number of divisors", "عدد القواسم"), fmtI(divCount(n))],
      [T("数位和", "Digit sum", "مجموع الأرقام"), fmtI(String(n).split("").reduce(function (a, b) { return a + (+b); }, 0))]]);
  };
  function divCount(n) { var c = 1, t = n; for (var i = 2; i * i <= t; i++) { if (t % i === 0) { var e = 0; while (t % i === 0) { t /= i; e++; } c *= (e + 1); } } if (t > 1) c *= 2; return c; }
  E.quadratic = function (v) {
    var a = num(v[0], 1), b = num(v[1], -3), c = num(v[2], 2);
    if (a === 0) return T("a 不能为 0", "a cannot be 0", "a لا يمكن أن يكون 0");
    var disc = b * b - 4 * a * c;
    if (disc < 0) return big(T("无实数解", "No real roots", "لا جذور حقيقية"), T("判别式 Δ = " + fmt(disc, 4), "Δ = " + fmt(disc, 4), "Δ = " + fmt(disc, 4)));
    var s = Math.sqrt(disc);
    return big("x₁ = " + fmt((-b + s) / (2 * a), 6) + "，x₂ = " + fmt((-b - s) / (2 * a), 6),
      T("Δ = " + fmt(disc, 4), "Δ = " + fmt(disc, 4), "Δ = " + fmt(disc, 4)))
      + rows([[T("顶点 x", "Vertex x", "قمة x"), fmt(-b / (2 * a), 6)],
      [T("顶点 y", "Vertex y", "قمة y"), fmt(a * Math.pow(-b / (2 * a), 2) + b * (-b / (2 * a)) + c, 6)],
      [T("两根之和", "Sum of roots", "مجموع الجذرين"), fmt(-b / a, 6)],
      [T("两根之积", "Product of roots", "حاصل ضرب الجذرين"), fmt(c / a, 6)]]);
  };
  E.stat = function (v) {
    var arr = String(v[0] || "").split(/[\s,，、]+/).map(function (x) { return parseFloat(x); }).filter(function (x) { return isFinite(x); });
    if (!arr.length) return T("请输入数字（空格或逗号分隔）", "Enter numbers separated by spaces/commas", "أدخل أرقامًا مفصولة بمسافات");
    var sum = arr.reduce(function (a, b) { return a + b; }, 0), n = arr.length;
    var mean = sum / n;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    var varc = arr.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n;
    var sd = Math.sqrt(varc);
    return big(fmt(mean, 4), T("共 " + n + T(" 个数", " numbers", " رقم"), "n = " + n))
      + rows([[T("中位数", "Median", "الوسيط"), fmt(median, 4)],
      [T("标准差（总体）", "Std dev (population)", "الانحراف المعياري"), fmt(sd, 4)],
      [T("方差", "Variance", "التباين"), fmt(varc, 4)],
      [T("最小 / 最大", "Min / Max", "أدنى / أقصى"), fmt(sorted[0], 4) + " / " + fmt(sorted[n - 1], 4)],
      [T("极差", "Range", "المدى"), fmt(sorted[n - 1] - sorted[0], 4)],
      [T("四分位 Q1 / Q3", "Q1 / Q3", "الربيع الأول / الثالث"), fmt(quantile(sorted, 0.25), 4) + " / " + fmt(quantile(sorted, 0.75), 4)]]);
  };
  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  }
  E.combinatorics = function (v, P) {
    var n = Math.floor(num(v[0], 5)), k = Math.floor(num(v[1], 2));
    if (k > n) return T("k 不能大于 n", "k must be ≤ n", "k يجب أن يكون ≤ n");
    function C(a, b) { b = Math.min(b, a - b); var r = 1; for (var i = 1; i <= b; i++) r = r * (a - b + i) / i; return Math.round(r); }
    function F(a, b) { var r = 1; for (var i = 1; i <= b; i++) r *= (a - i + 1); return r; }
    return big(P.mode === "perm" ? fmtI(F(n, k)) : fmtI(C(n, k)),
      P.mode === "perm" ? T("排列数 A(n,k)", "Permutations", "التوافيق") : T("组合数 C(n,k)", "Combinations", "التوليفات"))
      + rows([[T("n!", "n!", "n!"), fmtI(F(n, n))],
      [T("组合数 C(n,k)", "C(n,k)", "C(n,k)"), fmtI(C(n, k))],
      [T("排列数 A(n,k)", "A(n,k)", "A(n,k)"), fmtI(F(n, k))]]);
  };
  E.percentile = function (v) {
    var arr = String(v[0] || "").split(/[\s,，、]+/).map(parseFloat).filter(isFinite);
    if (!arr.length) return T("请输入数字", "Enter numbers", "أدخل أرقامًا");
    var p = num(v[1], 50) / 100;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var idx = (sorted.length - 1) * p, base = Math.floor(idx), rest = idx - base;
    var val = sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
    return big(fmt(val, 4), T("P" + num(v[1], 50) + " 分位（样本 " + arr.length + " 个）", "P" + num(v[1], 50) + " of " + arr.length, "المئين " + num(v[1], 50) + " من " + arr.length))
      + rows([[T("最小值", "Min", "أدنى"), fmt(sorted[0], 4)],
      [T("最大值", "Max", "أقصى"), fmt(sorted[sorted.length - 1], 4)],
      [T("中位数", "Median", "وسيط"), fmt(quantile(sorted, 0.5), 4)]]);
  };
  E.fraction = function (v) {
    var a = Math.floor(num(v[0])), b = Math.floor(num(v[1], 1));
    if (b === 0) return T("分母不能为 0", "Denominator cannot be 0", "المقام لا يمكن أن يكون 0");
    function g(x, y) { return y ? g(y, x % y) : x; }
    var d = g(Math.abs(a), Math.abs(b)) || 1;
    var n = a / d, m = b / d;
    return big(n + " / " + m, T("约分后", "In lowest terms", "مبسّطة"))
      + rows([[T("小数", "Decimal", "عشري"), fmt(a / b, 6)],
      [T("百分数", "Percent", "نسبة مئوية"), pct(a / b * 100)],
      [T("带分数", "Mixed number", "عدد مختلط"), (m ? Math.floor(a / b) + " 又 " + (a % b) + "/" + m : "-")]]);
  };

  /* ---------------- 8. 生活与家居 ---------------- */
  E.paint = function (v) {
    var area = num(v[0], 30), cover = num(v[1], 10), coats = num(v[2], 2), price = num(v[3], 60);
    var need = area * coats / cover;
    return big(fmt(need, 2) + T(" 升", " L", " لتر"),
      T("墙面 " + area + " m²，每升涂 " + cover + " m²，涂 " + coats + T(" 遍", " coats", " طبقة"), area + " m², " + cover + " m²/L, " + coats + " coats", area + " م²"))
      + rows([[T("建议购买量（含 10% 余量）", "Buy with 10% margin", "الشراء مع هامش 10%"), fmt(need * 1.1, 2) + T(" 升", " L", " لتر")],
      [T("涂料费用", "Paint cost", "تكلفة الطلاء"), money(need * price)],
      [T("每平米成本", "Cost per m²", "التكلفة للمتر المربع"), money(need * price / area)]]);
  };
  E.tile = function (v) {
    var area = num(v[0], 20), len = num(v[1], 60), wid = num(v[2], 60), waste = num(v[3], 5), price = num(v[4], 80);
    var per = (len / 100) * (wid / 100), need = area / per * (1 + waste / 100);
    return big(fmtI(need) + T(" 块", " tiles", " بلاطة"),
      T("每块 " + len + "×" + wid + " cm，面积 " + fmt(area, 2) + " m²", len + "×" + wid + " cm", len + "×" + wid + " سم"))
      + rows([[T("含损耗需购买", "With waste", "مع الهدر"), fmtI(need) + T(" 块", " tiles", " بلاطة")],
      [T("材料费用", "Material cost", "تكلفة المواد"), money(need * price)],
      [T("每平米造价", "Cost per m²", "التكلفة للمتر المربع"), money(need * price / area)]]);
  };
  E.flooring = function (v) {
    var area = num(v[0], 20), waste = num(v[1], 8), price = num(v[2], 150), labor = num(v[3], 40);
    var need = area * (1 + waste / 100);
    return big(money(need * price), T("含 " + waste + "% 损耗", "incl. " + waste + "% waste", "مع " + waste + "% هدر"))
      + rows([[T("需采购面积", "Area to buy", "الماحة المطلوبة"), fmt(need, 2) + " m²"],
      [T("人工费", "Labor", "أجرة العمل"), money(area * labor)],
      [T("总预算", "Total budget", "الإجمالي"), money(need * price + area * labor)]]);
  };
  E.concrete = function (v) {
    var l = num(v[0], 4), w = num(v[1], 3), t = num(v[2], 0.1), price = num(v[3], 480);
    var vol = l * w * t, bags = Math.ceil(vol / 0.02);
    return big(fmt(vol, 3) + T(" m³", " m³", " م³"),
      T("按 20kg/袋，每袋产 0.02 m³", "0.02 m³ per 20kg bag", "0.02 م³ لكل كيس 20 كجم"))
      + rows([[T("需袋数", "Bags needed", "عدد الأكياس"), fmtI(bags)],
      [T("材料费用", "Material cost", "تكلفة المواد"), money(vol * price)],
      [T("每平米造价", "Cost per m²", "التكلفة للمتر المربع"), money(vol * price / (l * w))]]);
  };
  E.electricity = function (v) {
    var kwh = num(v[0], 300), price = num(v[1], 0.55), tier = num(v[2], 0);
    return big(money(kwh * price), T("电价 " + fmt(price, 2) + " 元/度", "Tariff " + fmt(price, 2) + "/kWh", "التعرفة " + fmt(price, 2)))
      + rows([[T("年化（12 个月）", "Annualized", "سنوي"), money(kwh * price * 12)],
      [T("每天度数", "Daily average", "المتوسط اليومي"), fmt(kwh / 30, 1) + " kWh"],
      [T("相当于每天多少钱", "Cost per day", "التكلفة اليومية"), money(kwh * price / 30)]]);
  };
  E.fuel = function (v) {
    var l100 = num(v[0], 8), dist = num(v[1], 500), price = num(v[2], 7.5);
    var perKm = l100 / 100 * price;
    return big(money(perKm * dist), T("百公里 " + fmt(l100, 2) + " L，油价 " + fmt(price, 2), l100 + " L/100km", l100 + " لتر/100كم"))
      + rows([[T("每公里油费", "Cost per km", "التكلفة للكيلو"), money(perKm)],
      [T("年行驶 15000km 费用", "Cost at 15,000 km/yr", "لتكلفة 15000 كم/سنة"), money(perKm * 15000)],
      [T("每公里碳排放（2.3kg/L）", "CO₂ per km", "ثاني أكسيد الكربون/كم"), fmt(l100 / 100 * 2.3, 3) + " kg"]]);
  };
  E.solar = function (v) {
    var panels = num(v[0], 6), w = num(v[1], 550), sun = num(v[2], 4), price = num(v[3], 900), rate = num(v[4], 0.45);
    var kwhDay = panels * (w / 1000) * sun * rate, kwhYear = kwhDay * 365;
    return big(fmt(kwhYear, 0) + " kWh/年", T("每天 " + fmt(kwhDay, 2) + " kWh", fmt(kwhDay, 2) + " kWh/day", fmt(kwhDay, 2) + " كWh/يوم"))
      + rows([[T("系统总价", "System cost", "تكلفة النظام"), money(panels * price)],
      [T("度电成本（按 20 年）", "LCOE (20 yrs)", "تكلفة الكيلو (20 سنة)"), money(panels * price / (kwhYear * 20))],
      [T("年省电费（按 0.55 元/度）", "Annual savings", "التوفير السنوي"), money(kwhYear * 0.55)],
      [T("回本年限", "Payback years", "سنوات الاسترداد"), fmt(panels * price / (kwhYear * 0.55), 1) + T(" 年", " yrs", " سنة")]]);
  };
  E.battery = function (v) {
    var wh = num(v[0], 50000), load = num(v[1], 150), eff = num(v[2], 90) / 100;
    return big(fmt(wh * eff / load / 60, 2) + T(" 小时", " h", " ساعة"),
      T("负载 " + load + " W，效率 " + fmt(eff * 100, 0) + "%", "Load " + load + " W", "حمل " + load + " واط"))
      + rows([[T("可供电时长（分钟）", "Runtime (minutes)", "مدة التشغيل (دقيقة)"), fmt(wh * eff / load, 0)],
      [T("支持设备数（按 10W）", "Devices at 10W", "أجهزة بقدرة 10 واط"), fmtI(wh * eff / 10 / 60 / 24)],
      [T("充满所需时间（按 1kW 充电）", "Charge time at 1kW", "زمن الشحن 1 كيلوواط"), fmt(wh / 1000, 1) + T(" 小时", " h", " ساعة")]]);
  };
  E.recipe_scale = function (v) {
    var base = num(v[0], 4), target = num(v[1], 10);
    var f = target / base;
    return big("×" + fmt(f, 3), T("原 " + base + " 份 → " + target + T(" 份", " servings", " حصص"), base + " → " + target))
      + rows([[T("倍数", "Multiplier", "المضاعف"), fmt(f, 3)],
      [T("反向缩放（1 份需要）", "Per single serving", "لكل حصة"), fmt(1 / f, 4)],
      [T("常见换算（1 杯=240ml）", "Common conversion", "تحويل شائع"), fmt(f * 240, 0) + " ml"]]);
  };
  E.cooking_time = function (v) {
    var time = num(v[0], 30), alt = num(v[1], 2000), factor = 1 + Math.max(0, alt - 500) / 2500;
    return big(fmt(time * factor, 1) + T(" 分钟", " min", " دقيقة"),
      T("海拔每升高 500m 增加约 10%", "About +10% per 500m altitude", "زاد 10% لكل 500 متر"))
      + rows([[T("原始时间", "Original time", "الوقت الأصلي"), time + T(" 分钟", " min", " د")],
      [T("需增加", "Extra needed", "الوقت الإضافي"), fmt(time * (factor - 1), 1) + T(" 分钟", " min", " د")],
      [T("倍增温度（1000m）", "At 1000m", "عند 1000 متر"), fmt(time * (1 + Math.max(0, 1000 - 500) / 2500), 1) + T(" 分钟", " min", " د")]]);
  };
  E.pet_age = function (v) {
    var kind = P_pet(v), years = num(v[0], 3);
    var human = kind === "cat" ? (years < 1 ? years * 15 : 15 + (years - 1) * 4)
      : (years < 1 ? years * 15 : 15 + (years - 1) * 4.5);
    return big(fmt(human, 1) + T(" 岁（人类年龄）", " (human years)", " (بسنوات بشرية)"),
      T("猫狗换算为首年 15 岁、之后逐年递增", "First year ≈ 15, then +4/4.5 per year", "السنة الأولى 15 ثم زيادة"))
      + rows([[T("相当于多少猫/狗年", "In pet years", "بسنوات الحيوان"), fmt(years, 1) + T(" 岁", " yrs", " سنة")],
      [T("剩余寿命（中位）", "Median lifespan left", "العمر المتبقي"), fmt(Math.max(0, (kind === "cat" ? 15 : 13) - years), 1) + T(" 年", " yrs", " سنة")]]);
  };
  function P_pet(v) { return v[1] === "dog" ? "dog" : "cat"; }
  E.pet_food = function (v) {
    var kg = num(v[0], 5), activity = num(v[1], 1.2), kind = P_pet(v);
    var daily = kind === "cat" ? kg * 25 : kg * 55 * activity;
    return big(fmt(daily, 0) + T(" 克/天", " g/day", " غ/يوم"),
      T("猫约 25g/kg，犬约 55g/kg×活动系数", "Cat ≈25g/kg, dog ≈55g/kg", "القطط 25 غ/كجم والكلاب 55 غ/كجم"))
      + rows([[T("每月用量", "Monthly", "شهري"), fmt(daily * 30 / 1000, 2) + T(" kg", " kg", " كجم")],
      [T("年用量", "Yearly", "سنوي"), fmt(daily * 365 / 1000, 2) + T(" kg", " kg", " كجم")],
      [T("按单价估算月成本", "Monthly cost", "التكلفة الشهرية"), P_price(v) ? money(daily * 30 * P_price(v)) : "-"]]);
  };
  function P_price(v) { var p = parseFloat(v[2]); return isFinite(p) ? p : 0; }

  /* ---------------- 9. 电商与营销 ---------------- */
  E.cpc_cpm = function (v) {
    var clicks = num(v[0], 1000), spend = num(v[1], 500), imp = num(v[2], 50000);
    var cpc = clicks ? spend / clicks : 0, cpm = imp ? spend / imp * 1000 : 0, ctr = imp ? clicks / imp * 100 : 0;
    return big(money(cpc) + T(" / 点击", " / click", " / نقرة"),
      T("花费 " + money(spend) + "，点击 " + clicks + "，曝光 " + imp, "Spend " + money(spend), "إنفاق " + money(spend)))
      + rows([[T("CPM（千次曝光成本）", "CPM", "CPM"), money(cpm)],
      [T("CTR 点击率", "CTR", "CTR"), pct(ctr)],
      [T("CPA（按 5% 转化）", "CPA (5% CVR)", "CPA (تحويل 5%)"), money(cpc / 0.05)],
      [T("每千次曝光收益（按转化）", "RPM (5% CVR)", "RPM (تحويل 5%)"), money(cpm * 0.05)]]);
  };
  E.conversion_rate = function (v) {
    var visits = num(v[0], 1000), orders = num(v[1], 20);
    var cr = visits ? orders / visits * 100 : 0;
    return big(pct(cr), T("访客 " + visits + "，成交 " + orders, visits + " visits, " + orders + " orders", visits + " زيارة، " + orders + " طلب"))
      + rows([[T("每 100 访客成交数", "Orders per 100 visits", "طلبات لكل 100 زيارة"), fmt(orders / visits * 100, 2)],
      [T("达到 3% 需成交", "Orders for 3% CRR", "طلبات لـ 3%"), fmt(visits * 0.03, 1)],
      [T("客单价（按 100 元）", "AOV (at ¥100)", "متوسط قيمة الطلب"), money(orders * 100 / Math.max(orders, 1))],
      [T("转化率翻倍的影响", "Effect of doubling CRR", "تأثير مضاعفة التحويل"), "+" + fmt(cr, 2) + T(" 个百分点", " points", " نقطة")]]);
  };
  E.aov = function (v) {
    var orders = num(v[0], 100), revenue = num(v[1], 8000);
    var aov = orders ? revenue / orders : 0;
    return big(money(aov), T("总营收 " + money(revenue) + "，订单 " + orders, "Revenue " + money(revenue), "الإيراد " + money(revenue)))
      + rows([[T("客单价提升 10% 的营收", "Revenue at +10% AOV", "الإيراد مع +10%"), money(orders * aov * 1.1)],
      [T("订单增加 10% 的营收", "Revenue at +10% orders", "الإيراد مع +10% طلبات"), money(orders * 1.1 * aov)],
      [T("两者各 +10%", "Both +10%", "كلاهما +10%"), money(orders * 1.1 * aov * 1.1)]]);
  };
  E.roi_ads = function (v) {
    var spend = num(v[0], 1000), leads = num(v[1], 50), close = num(v[2], 10) / 100, price = num(v[3], 300);
    var revenue = leads * close * price, roi = spend ? (revenue - spend) / spend * 100 : 0;
    return big(pct(roi), T("投放 " + money(spend) + "，线索 " + leads, "Spend " + money(spend), "إنفاق " + money(spend)))
      + rows([[T("预估成交数", "Expected sales", "المبيعات المتوقعة"), fmt(leads * close, 1)],
      [T("预估营收", "Projected revenue", "الإيراد المتوقع"), money(revenue)],
      [T("单次线索成本", "Cost per lead", "تكلفة العميل المحتمل"), money(spend / leads)],
      [T("回本所需转化率", "Break-even CVR", "نسبة التحويل للتعادل"), pct(spend / (leads * price) * 100)]]);
  };
  E.ad_budget = function (v) {
    var total = num(v[0], 10000), c1 = num(v[1], 40), c2 = num(v[2], 30), c3 = num(v[3], 30);
    var s = c1 + c2 + c3;
    return big(money(total * (c1 / s)) + T("（第一项）", " (first bucket)", " (الحاوية الأولى)"),
      T("按 " + c1 + ":" + c2 + ":" + c3 + " 分配", "Split " + c1 + ":" + c2 + ":" + c3, "توزيع " + c1 + ":" + c2 + ":" + c3))
      + rows([[T("第一项", "Bucket 1", "الحاوية 1"), money(total * c1 / s)],
      [T("第二项", "Bucket 2", "الحاوية 2"), money(total * c2 / s)],
      [T("第三项", "Bucket 3", "الحاوية 3"), money(total * c3 / s)],
      [T("按 CPM 估算可买曝光", "Impressions at CPM", "ظهور عند CPM"), fmt(total * c1 / s / P_cpm(v) * 1000, 0)]]);
  };
  function P_cpm(v) { var c = parseFloat(v[3]); return isFinite(c) && c > 0 ? c : 30; }
  E.seo_ctr = function (v) {
    var imp = num(v[0], 10000), clicks = num(v[1], 250), pos = num(v[2], 5);
    var ctr = imp ? clicks / imp * 100 : 0, expected = imp * (0.28 / pos) / 100;
    return big(pct(ctr), T("第 " + pos + " 位，平均 CTR 约 " + fmt(0.28 / pos * 100, 1) + "%", "Position " + pos, "المرتبة " + pos))
      + rows([[T("该位置预期点击", "Expected clicks", "النقرات المتوقعة"), fmt(expected, 1)],
      [T("CTR 提升 1 个百分点带来的点击", "Extra clicks at +1pp CTR", "نقرات إضافية عند +1%"), fmt(imp * 0.01, 0)],
      [T("按每次点击 3 元计的增量价值", "Value at ¥3/click", "القيمة عند 3 yuan/نقرة"), money(imp * 0.01 * 3)]]);
  };
  E.cart_recovery = function (v) {
    var carts = num(v[0], 1000), recover = num(v[1], 8) / 100, aov = num(v[2], 120);
    return big(money(carts * recover * aov), T("弃单 " + carts + "，挽回率 " + fmt(recover * 100, 1) + "%", carts + " carts", carts + " سلة"))
      + rows([[T("挽回订单数", "Recovered orders", "طلبات مسترجعة"), fmtI(carts * recover)],
      [T("每 1% 挽回率的增量", "Revenue per +1% recovery", "الإيراد لكل +1%"), money(carts * 0.01 * aov)],
      [T("提高客单价 10% 的增量", "Revenue at +10% AOV", "الإيراد مع +10% متوسط"), money(carts * recover * aov * 0.1)]]);
  };
  E.price_elasticity = function (v) {
    var p0 = num(v[0], 100), q0 = num(v[1], 1000), p1 = num(v[2], 90), q1 = num(v[3], 1150);
    var dp = (p1 - p0) / p0, dq = (q1 - q0) / q0;
    var e = dp === 0 ? 0 : dq / dp;
    return big(fmt(e, 3), T("价格弹性（需求变动% ÷ 价格变动%）", "Elasticity (ΔQ% ÷ ΔP%)", "المرونة (تغير الكمية ÷ تغير السعر)"))
      + rows([[T("价格变动", "Price change", "تغير السعر"), pct(dp * 100)],
      [T("销量变动", "Quantity change", "تغير الكمية"), pct(dq * 100)],
      [T("营收变化", "Revenue change", "تغير الإيراد"), pct((p1 * q1) / (p0 * q0) * 100 - 100)],
      [T("提价 10% 的销量预估", "Volume at +10% price", "الكمية عند +10%"), fmtI(q0 * (1 + e * 0.1))]]);
  };

  /* ---------------- 10. 教育与效率 ---------------- */
  E.grade = function (v) {
    var score = num(v[0], 85), full = num(v[1], 100);
    var p = full ? score / full * 100 : 0;
    var g = p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "E";
    var gp = { "A": 4.0, "B": 3.5, "C": 3.0, "D": 2.0, "E": 1.0 }[g];
    return big(g + T("（" + fmt(p, 1) + " 分）", " (" + fmt(p, 1) + "%)", " (" + fmt(p, 1) + "%)"),
      T("得分 " + score + " / " + full, "Score " + score + "/" + full, "الدرجة " + score + "/" + full))
      + rows([[T("绩点", "GPA points", "نقاط GPA"), fmt(gp, 1)],
      [T("距下一等级还差", "To next grade", "للمستوى التالي"), fmt(p >= 90 ? 0 : (p >= 80 ? 90 : p >= 70 ? 80 : p >= 60 ? 70 : 60) - p, 1) + T(" 分", " points", " نقطة")],
      [T("及格线（60%）", "Pass line (60%)", "خط النجاح"), fmt(full * 0.6, 1)]]);
  };
  E.study_plan = function (v) {
    var days = num(v[0], 30), perDay = num(v[1], 2), total = num(v[2], 600);
    var need = total / Math.max(days * perDay, 1);
    return big(fmtI(need) + T(" 题/天", " questions/day", " سؤال/يوم"),
      T("共 " + days + T(" 天，每天 " + perDay + T(" 轮", " rounds", " جولة"), days + " days", days + " يوم")))
      + rows([[T("总轮数", "Total rounds", "إجمالي الجولات"), fmtI(days * perDay)],
      [T("每轮题数", "Questions per round", "أسئلة كل جولة"), fmtI(total / Math.max(days * perDay, 1))],
      [T("需要的总天数（按每天 1 轮）", "Days at 1 round/day", "الأيام بجولة واحدة"), fmtI(total)],
      [T("建议复习间隔（天）", "Suggested spacing", "فاصل المراجعة المقترح"), "1 / 3 / 7 / 15"]]);
  };
  E.pomodoro = function (v) {
    var work = num(v[0], 25), brk = num(v[1], 5), rounds = num(v[2], 4);
    var total = (work + brk) * rounds - brk;
    return big(fmt(total / 60, 2) + T(" 小时", " h", " ساعة"),
      T(rounds + T(" 轮番茄钟", " pomodoros", " جولة بومودورو"), rounds + " pomodoros", rounds + " جولات"))
      + rows([[T("纯专注时间", "Focus time", "وقت التركيز"), fmt(work * rounds, 0) + T(" 分钟", " min", " د")],
      [T("休息总时长", "Break time", "إجمالي الراحة"), fmt(brk * (rounds - 1), 0) + T(" 分钟", " min", " د")],
      [T("每轮结束时刻", "Ends at", "ينتهي عند"), (function () { var s = num(v[3], 9) * 60, e = s + total; var hh = Math.floor(e / 60) % 24, mm = e % 60; return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); })()]]);
  };
  E.time_billing = function (v) {
    var hours = num(v[0], 7.5), rate = num(v[1], 500), days = num(v[2], 20), tax = num(v[3], 6) / 100;
    var sub = hours * rate, gross = sub * days, net = gross * (1 + tax);
    return big(money(net) + T(" 含税", " incl. tax", " شامل الضريبة"),
      T("时薪 " + money(rate) + " × " + hours + T(" 小时 × ", " h × ", " س × ") + days + T(" 天", " days", " يوم"), ""))
      + rows([[T("税前总额", "Subtotal", "المجموع قبل الضريبة"), money(gross)],
      [T("税额", "Tax", "الضريبة"), money(net - gross)],
      [T("日均（含税）", "Daily incl. tax", "يومي شامل الضريبة"), money(net / days)],
      [T("有效时薪（含税）", "Effective hourly", "الأجر الصافي للساعة"), money(net / (days * hours))]]);
  };
  E.invoice_total = function (v) {
    var items = String(v[0] || "").split("\n").filter(Boolean), rate = num(v[1], 500), tax = num(v[2], 6) / 100, disc = num(v[3], 0);
    var sub = 0, detail = [];
    items.forEach(function (line) {
      var m = line.match(/^(.+?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/);
      var name = line, qty = 1;
      if (m) { name = m[1]; qty = parseFloat(m[2]); }
      var amt = qty * rate; sub += amt;
      detail.push([name.trim() + " × " + qty, money(amt)]);
    });
    var after = sub * (1 - disc / 100), net = after * (1 + tax);
    return big(money(net) + T("（含税）", " incl. tax", " شامل الضريبة"), T(sub + T(" 项", " items", " بند"), ""))
      + rows(detail.concat([
        [T("小计", "Subtotal", "المجموع الفرعي"), money(sub)],
        [T("折扣", "Discount", "الخصم"), "- " + money(sub - after)],
        [T("税额", "Tax", "الضريبة"), money(net - after)]
      ]));
  };
  E.fourty_two = function (v) {
    var q = String(v[0] || "").split(/[\s,，、]+/).map(parseFloat).filter(isFinite);
    if (!q.length) return T("请输入数字", "Enter numbers", "أدخل أرقامًا");
    var s = q.reduce(function (a, b) { return a + b; }, 0), n = q.length;
    var mn = Math.min.apply(null, q), mx = Math.max.apply(null, q);
    var sorted = q.slice().sort(function (a, b) { return a - b; });
    var med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    return big(fmt(s, 4) + T(" 总和", " total", " المجموع"),
      T("共 " + n + T(" 个数", " numbers", " رقم"), "", ""))
      + rows([[T("平均", "Mean", "المتوسط"), fmt(s / n, 4)],
      [T("中位数", "Median", "الوسيط"), fmt(med, 4)],
      [T("最小 / 最大", "Min / Max", "أدنى / أقصى"), fmt(mn, 4) + " / " + fmt(mx, 4)],
      [T("极差", "Range", "المدى"), fmt(mx - mn, 4)],
      [T("奇数个数 / 偶数个数", "Odd / Even count", "فردي / زوجي"), q.filter(function (x) { return x % 2 !== 0; }).length + " / " + q.filter(function (x) { return x % 2 === 0; }).length]]);
  };
  E.gpa = function (v) {
    var credits = String(v[0] || "").split(/[\s,，、]+/).map(parseFloat).filter(isFinite);
    var grades = String(v[1] || "").split(/[\s,，、]+/).map(parseFloat).filter(isFinite);
    if (!credits.length || credits.length !== grades.length) return T("学分与成绩数量需一致", "Credits and grades must match", "يجب تطابق Credits مع الدرجات");
    var scale = [4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1.3, 1];
    var tp = 0, tc = 0;
    for (var i = 0; i < credits.length; i++) {
      var idx = Math.min(scale.length - 1, Math.max(0, Math.round((grades[i] - 60) / 4)));
      tp += scale[idx] * credits[i]; tc += credits[i];
    }
    var gpa = tc ? tp / tc : 0;
    return big(fmt(gpa, 3), T("总学分 " + fmt(tc, 1), "Total credits " + fmt(tc, 1), "إجمالي الساعات " + fmt(tc, 1)))
      + rows([[T("加权绩点总和", "Quality points", "مجموع النقاط"), fmt(tp, 2)],
      [T("4.0 制最高绩点", "Max GPA", "أقصى معدل"), fmt(gpa >= 3.9 ? 4 : gpa >= 3.7 ? 3.85 : gpa >= 3.5 ? 3.7 : gpa >= 3.3 ? 3.5 : gpa >= 3.0 ? 3.3 : gpa >= 2.7 ? 3.0 : gpa >= 2.3 ? 2.7 : gpa >= 2.0 ? 2.3 : gpa >= 1.7 ? 2.0 : gpa >= 1.3 ? 1.7 : 1.0, 2)],
      [T("距 3.5 还差", "To 3.5 GPA", "لتحقيق 3.5"), fmt(Math.max(0, 3.5 - gpa), 3)]]);
  };

  /* ---------------- 11. 旅行与出行 ---------------- */
  E.trip_budget = function (v) {
    var people = num(v[0], 2), days = num(v[1], 5), transport = num(v[2], 1200), stay = num(v[3], 400), food = num(v[4], 150), play = num(v[5], 200);
    var per = (transport + stay * (P_rooms(v) || 1) + food + play) / people;
    var total = per * people * days + transport;
    return big(money(total), T(people + T(" 人 ", " people, ", " أشخاص ") + days + T(" 天", " days", " أيام"), "", ""))
      + rows([[T("人均（不含交通）", "Per person (ex. transport)", "لكل شخص (بدون نقل)"), money(per * days)],
      [T("人均日均", "Per person per day", "لكل شخص يوميًا"), money(per * days / days)],
      [T("交通占比", "Transport share", "حصة النقل"), pct(total === 0 ? 0 : transport / total * 100)],
      [T("住宿占比", "Stay share", "حصة الإقامة"), pct(total === 0 ? 0 : stay * (P_rooms(v) || 1) * people * days / total * 100)]]);
  };
  function P_rooms(v) { var r = parseFloat(v[6]); return isFinite(r) ? r : 1; }
  E.depart_by = function (v) {
    var dist = num(v[0], 500), speed = num(v[1], 80), buffer = num(v[2], 30), arrive = v[3] || "09:00";
    var h = parseInt(arrive.slice(0, 2)), m = parseInt(arrive.slice(3, 5));
    var need = dist / speed * 60 + buffer;
    var depart = (h * 60 + m - need);
    var dayShift = 0;
    while (depart < 0) { depart += 1440; dayShift--; }
    var hh = Math.floor(depart / 60) % 24, mm = Math.round(depart % 60);
    return big(String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"),
      T("需 " + fmt(need, 0) + T(" 分钟（含缓冲）", " min incl. buffer", " دقيقة مع هامش"), ""))
      + rows([[T("行驶时间", "Driving time", "وقت القيادة"), fmt(dist / speed * 60, 0) + T(" 分钟", " min", " د")],
      [T("缓冲时间", "Buffer", "هامش الأمان"), buffer + T(" 分钟", " min", " د")],
      [T("建议提前出发天数", "Days earlier (if >24h)", "أيام أبكر"), dayShift < 0 ? Math.abs(dayShift) + T(" 天", " days", " يوم") : T("当天", "Same day", "نفس اليوم")]]);
  };
  E.postage = function (v) {
    var kg = num(v[0], 1), zone = num(v[1], 1), perKg = num(v[2], 12), base = num(v[3], 5);
    var cost = base + kg * perKg * zone;
    return big(money(cost), T("计费重 " + fmt(kg, 2) + " kg，资费区 " + zone, "Weight " + fmt(kg, 2) + " kg", "الوزن " + fmt(kg, 2) + " كجم"))
      + rows([[T("首重费用", "Base fee", "الرسوم الأساسية"), money(base)],
      [T("续重费用", "Per-kg fee", "رسوم الكيلو"), money(kg * perKg * zone)],
      [T("每公斤成本", "Cost per kg", "التكلفة للكيلو"), money(kg ? cost / kg : 0)]]);
  };
  E.ev_charge = function (v) {
    var kwh = num(v[0], 30), price = num(v[1], 1.2), eff = num(v[2], 90) / 100, range = num(v[3], 300);
    var cost = kwh * price, per100 = range ? cost / range * 100 : 0;
    return big(money(cost) + T(" / 充满", " / full charge", " / شحن كامل"),
      T("电池 " + range + " km，效率 " + fmt(eff * 100, 0) + "%", "Range " + range + " km", "المدى " + range + " كم"))
      + rows([[T("每 100km 电费", "Cost per 100 km", "تكلفة 100 كم"), money(per100)],
      [T("与油车对比（0.6L/100km，7.5 元/L）", "vs petrol (¥0.6/100km)", "مقابل البنزين"), money(0.6 * 7.5) + T(" → 省 ", " → save ", " → وفّر ") + money(0.6 * 7.5 - per100)],
      [T("年行驶 15000km 的电费", "Yearly at 15,000 km", "سنويًا عند 15000 كم"), money(per100 * 150)]]);
  };
  E.gear_ratio = function (v) {
    var teeth = num(v[0], 50), cog = num(v[1], 20), wheel = num(v[2], 700);
    var ratio = teeth / cog, dev = ratio * wheel / 1000;
    return big(fmt(ratio, 3) + " : 1", T("牙盘 " + teeth + "T，飞轮 " + cog + "T", teeth + "T / " + cog + "T", teeth + "T / " + cog + "T"))
      + rows([[T("开发量（米/圈）", "Development (m/turn)", "التطور (م/دورة)"), fmt(dev, 2)],
      [T("每圈踏板次数", "Pedal turns per wheel turn", "دورات البدالة لكل دورة عجلة"), fmt(ratio, 3)],
      [T("相同齿比下速度/效率", "Speed vs efficiency", "السرعة مقابل الكفاءة"), T("高齿比更快但更费力", "Higher = faster, harder", "أعلى = أسرع وأصعب")]]);
  };
  E.carpool = function (v) {
    var people = num(v[0], 4), dist = num(v[1], 30), fuel = num(v[2], 8), price = num(v[3], 7.5);
    var per = (dist * fuel / 100 * price) / people;
    return big(money(per) + T(" / 人", " per person", " للفرد"),
      T("" + people + T(" 人分摊", " people sharing", " يشاركون") + fmt(dist, 0) + " km", "", ""))
      + rows([[T("单车总油费", "Total fuel cost", "إجمالي الوقود"), money(dist * fuel / 100 * price)],
      [T("相对独驾节省", "Saved vs solo", "التوفير مقابل الانفراد"), money(dist * fuel / 100 * price - per)],
      [T("碳排放减少", "CO₂ avoided", "خفض ثاني أكسيد الكربون"), fmt(dist * fuel / 100 * 2.3 * (people - 1) / people, 2) + " kg"]]);
  };

  /* ---------------- 12. 居家/家装/其它 ---------------- */
  E.wallpaper = function (v) {
    var per = num(v[0], 5.2), wall = num(v[1], 60), ceil = num(v[2], 2.5), waste = num(v[3], 10);
    var area = wall * ceil, rolls = Math.ceil(area / per * (1 + waste / 100));
    return big(rolls + T(" 卷", " rolls", " رول"),
      T("墙面 " + fmt(area, 1) + " m²，每卷 " + fmt(per, 1) + " m²", area + " m²", fmt(area, 1) + " م²"))
      + rows([[T("需覆盖面积", "Area to cover", "الماحة المطلوبة"), fmt(area, 1) + " m²"],
      [T("含损耗卷数", "With waste", "مع الهدر"), rolls + T(" 卷", " rolls", " رول")],
      [T("每卷成本（按 60 元）", "Cost per roll (¥60)", "تكلفة الرول (60)"), money(rolls * 60)]]);
  };
  E.bricks = function (v) {
    var wall = num(v[0], 3), thick = num(v[1], 0.24), brickL = num(v[2], 0.24), brickH = num(v[3], 0.115), mortar = num(v[4], 0.01);
    var perBrick = (brickL + mortar) * (brickH + mortar);
    var count = Math.ceil(area(wall) / perBrick);
    function area(w) { return w * w; }
    return big(fmtI(count) + T(" 块", " bricks", " طوبة"),
      T("含 1cm 灰缝", "Includes 1cm mortar", "يشمل 1 سم ملاط"))
      + rows([[T("每块覆盖面积", "Area per brick", "الماحة لكل طوبة"), fmt(perBrick, 4) + " m²"],
      [T("理论块数", "Theoretical count", "العدد النظري"), fmtI(area(wall) / perBrick)],
      [T("损耗预留 5%", "With 5% waste", "مع هدر 5%"), fmtI(count * 1.05)]]);
  };
  E.bmi_reverse = function (v) {
    var b = num(v[0], 22), h = num(v[1], 170) / 100;
    return big(fmt(b * h * h, 1) + T(" kg", " kg", " كجم"),
      T("BMI " + fmt(b, 1) + "，身高 " + fmt(h * 100, 0) + " cm", "BMI " + fmt(b, 1), "مؤشر " + fmt(b, 1)))
      + rows([[T("对应 BMI 18.5", "At BMI 18.5", "عند مؤشر 18.5"), fmt(18.5 * h * h, 1) + " kg"],
      [T("对应 BMI 25", "At BMI 25", "عند مؤشر 25"), fmt(25 * h * h, 1) + " kg"],
      [T("目标体重差", "Delta to target", "الفرق للهدف"), fmt(b * h * h - 22 * h * h, 1) + " kg"]]);
  };
  E.calorie_target = function (v) {
    var w = num(v[0], 60), h = num(v[1], 170), age = num(v[2], 30), male = v[3] === 1 || v[3] === "1", goal = v[4] || "cut";
    var bmr = 10 * w + 6.25 * h - 5 * age + (male ? 5 : -161);
    var tdee = bmr * 1.375;
    var target = goal === "cut" ? tdee - 500 : goal === "gain" ? tdee + 300 : tdee;
    return big(fmtI(target) + " kcal/天", T("目标：" + (goal === "cut" ? "减脂" : goal === "gain" ? "增肌" : "维持"), goal === "cut" ? "Cut" : goal === "gain" ? "Gain" : "Maintain", "الهدف: " + (goal === "cut" ? "إنقاص" : goal === "gain" ? "زيادة" : "محافظة")))
      + rows([[T("基础代谢 BMR", "BMR", "الاستقلاب الأساسي"), fmtI(bmr)],
      [T("每日消耗 TDEE", "TDEE", "الصرف اليومي"), fmtI(tdee)],
      [T("蛋白建议（1.6g/kg）", "Protein (1.6g/kg)", "بروتين 1.6 غ/كجم"), fmtI(w * 1.6) + " g"],
      [T("饮水建议", "Water", "الماء"), fmtI(w * 35) + " ml"]]);
  };
  E.weight_watch = function (v) {
    var start = num(v[0], 70), cur = num(v[1], 68), target = num(v[2], 65), days = num(v[3], 30);
    var done = start - cur, need = start - target, rate = days ? done / days : 0;
    var eta = rate > 0 ? Math.ceil(need / rate) : 0;
    return big(done.toFixed(1) + T(" kg（已减）", " kg lost", " كجم مفقود"),
      T("目标还差 " + (need - done).toFixed(1) + " kg", "Target gap " + (need - done).toFixed(1) + " kg", "الفجوة " + (need - done).toFixed(1)))
      + rows([[T("完成度", "Progress", "نسبة الإنجاز"), pct(need === 0 ? 0 : done / need * 100)],
      [T("当前速度", "Current rate", "المعدل الحالي"), fmt(rate, 3) + " kg/" + T("天", "/day", "/يوم")],
      [T("预计达标还需", "ETA", "الوقت المتبقي"), eta ? eta + T(" 天", " days", " يوم") : T("当前速度无法达成", "Not achievable at this rate", "غير قابل للتحقيق")]]);
  };
  E.inflation_adj = E.inflation;
  E.salary_offer = function (v) {
    var cur = num(v[0], 15000), offer = num(v[1], 18000), bonus = num(v[2], 3), years = num(v[3], 3), commute = num(v[3 + 1], 0);
    var diff = offer - cur - commute * 12;
    return big(money(diff * 12) + T(" / 年差额", " / year", " سنويًا"),
      T("现 " + money(cur) + "，offer " + money(offer), "Current " + money(cur), "الحالي " + money(cur)))
      + rows([[T("薪资涨幅", "Raise %", "نسبة الزيادة"), pct(cur === 0 ? 0 : (offer - cur) / cur * 100)],
      [T("年奖金（按月薪 × 月数）", "Annual bonus", "المكافأة السنوية"), money(offer * bonus)],
      [T("多年平均年包", "Average package", "متوسط الحزمة"), money((offer * 12 + offer * bonus) / years)],
      [T("综合年包（含奖金）", "Total comp", "الإجمالي مع المكافأة"), money(offer * 12 + offer * bonus)]]);
  };
  E.freelance_tax = function (v) {
    var income = num(v[0], 200000), rate = num(v[1], 20) / 100, cost = num(v[2], 20000);
    var taxable = Math.max(0, income - cost);
    return big(money(taxable * rate), T("应税所得 " + money(taxable), "Taxable " + money(taxable), "الخاضع " + money(taxable)))
      + rows([[T("税后收入", "After tax", "صافي الدخل"), money(income - taxable * rate)],
      [T("实际税负率", "Effective rate", "المعدل الفعلي"), pct(income === 0 ? 0 : taxable * rate / income * 100)],
      [T("成本占比", "Cost share", "نسبة التكلفة"), pct(income === 0 ? 0 : cost / income * 100)],
      [T("时薪（按 1500 小时/年）", "Hourly (1500 h/yr)", "أجر الساعة"), money((income - taxable * rate) / 1500)]]);
  };
  E.stock_sip = function (v) {
    var monthly = num(v[0], 1000), years = num(v[1], 10), annual = num(v[2], 8) / 100;
    var r = annual / 12, fv = monthly * (Math.pow(1 + r, years * 12) - 1) / r * (1 + r);
    return big(money(fv), T("每月 " + money(monthly) + "，年化 " + fmt(annual * 100, 1) + "%", "Monthly " + money(monthly), "شهريًا " + money(monthly)))
      + rows([[T("本金投入", "Total invested", "إجمالي المستثمر"), money(monthly * years * 12)],
      [T("收益", "Gains", "الأرباح"), money(fv - monthly * years * 12)],
      [T("收益占投入比例", "Gains / invested", "الأرباح ÷ المستثمر"), pct(monthly * years * 12 === 0 ? 0 : (fv - monthly * years * 12) / (monthly * years * 12) * 100)]]);
  };
  E.warranty = function (v) {
    var price = num(v[0], 5000), years = num(v[1], 3), perYear = num(v[2], 100);
    return big(money(price / years) + T(" / 年", " / year", " سنويًا"),
      T("总价 " + money(price) + "，保 " + years + T(" 年", " years", " سنة"), "Total " + money(price), "الإجمالي " + money(price)))
      + rows([[T("每年维修自付", "Annual self-pay", "الذاتي السنوي"), money(perYear)],
      [T("有保时的年成本", "Annual cost with warranty", "التكلفة السنوية مع الضمان"), money(perYear + price / years)],
      [T("无保时的年成本", "Annual cost without warranty", "التكلفة بلا ضمان"), money(perYear)],
      [T("保本临界维修次数", "Break-even repairs", "عدد الإصلاحات للتعادل"), fmt(price / (perYear || 1), 1) + T(" 次/年", " /yr", " /سنة")]]);
  };
  E.carbon_footprint = function (v) {
    var kwh = num(v[0], 300), gas = num(v[1], 50), km = num(v[2], 5000), meat = num(v[3], 20);
    var total = kwh * 0.55 + gas * 2.3 + km * 0.17 + meat * 6.5;
    return big(fmt(total, 1) + T(" kg CO₂e/年", " kg CO₂e/yr", " كجم CO₂e/سنة"),
      T("电 + 燃气 + 出行 + 饮食", "Electricity + gas + travel + food", "كهرباء + غاز + تنقل + طعام"))
      + rows([[T("电力部分", "Electricity", "الكهرباء"), fmt(kwh * 0.55, 1) + " kg"],
      [T("燃气部分", "Gas", "الغاز"), fmt(gas * 2.3, 1) + " kg"],
      [T("出行部分", "Travel", "التنقل"), fmt(km * 0.17, 1) + " kg"],
      [T("饮食部分", "Food", "الطعام"), fmt(meat * 6.5, 1) + " kg"],
      [T("相当于种树（每棵年固碳 20kg）", "Equivalent trees", "ما يعادل أشجار"), fmt(total / 20, 1) + T(" 棵", " trees", " شجرة")]]);
  };
  E.reading_light = function (v) {
    var lux = num(v[0], 500), age = num(v[1], 10);
    var need = 500 * Math.pow(1.1, age);
    return big(fmtI(need) + T(" lux", " lux", " لوكس"),
      T("每 10 年约需增加 10% 照度", "≈ +10% per decade", "≈ +10% كل عقد"))
      + rows([[T("当前照度达标比例", "Current adequacy", "كفاية الإضاءة الحالية"), pct(lux / need * 100)],
      [T("建议灯具功率（流明效率 80lm/W）", "Suggested wattage (80lm/W)", "الواط المقترح"), fmt(need / 80, 0) + " W"],
      [T("阅读距离建议", "Reading distance", "مسافة القراءة"), "30–50 cm"]]);
  };
  E.recharge_cycles = function (v) {
    var cap = num(v[0], 50), dod = num(v[1], 80), cycles = num(v[2], 3000), temp = num(v[3], 25);
    var usable = cap * dod / 100, life = cycles * (temp > 30 ? 0.8 : 1);
    return big(fmtI(life) + T(" 次循环", " cycles", " دورة"),
      T("可用容量 " + fmt(usable, 1) + " kWh（DoD " + dod + "%）", "Usable " + fmt(usable, 1) + " kWh", "قابل للاستخدام " + fmt(usable, 1)))
      + rows([[T("折合日历寿命", "Calendar life", "العمر التقويمي"), fmt(life / 365, 1) + T(" 年", " yrs", " سنة")],
      [T("全生命周期放电量", "Lifetime throughput", "إجمالي التفريغ"), fmt(usable * life, 0) + " kWh"],
      [T("温度惩罚", "Temperature penalty", "عقوبة الحرارة"), temp > 30 ? pct((1 - 0.8) * 100, 0) : T("无", "None", "لا شيء")]]);
  };
  E.tax_year = function (v) {
    var income = num(v[0], 100000), deduction = num(v[1], 60000), brackets = P_brackets(v);
    var tax = 0, remain = Math.max(0, income - deduction);
    var detail = [];
    for (var i = 0; i < brackets.length; i++) {
      var lo = brackets[i][0], hi = brackets[i][1], rate = brackets[i][2];
      if (remain <= lo) break;
      var part = Math.min(remain, hi) - lo;
      if (part > 0) { tax += part * rate; detail.push([fmtI(lo) + "–" + fmtI(hi) + " 档", money(part * rate) + "（" + fmt(rate * 100, 1) + "%）"]); }
    }
    return big(money(tax), T("应纳税所得 " + money(remain), "Taxable " + money(remain), "الخاضع " + money(remain)))
      + rows(detail.concat([[T("税后收入", "After tax", "صافي الدخل"), money(income - tax)],
      [T("实际税负率", "Effective rate", "المعدل الفعلي"), pct(income === 0 ? 0 : tax / income * 100)]]));
  };
  function P_brackets(v) {
    try { return JSON.parse(v[2] || "[]"); } catch (e) { return [[0, 3000, 0.03], [3000, 12000, 0.1], [12000, 25000, 0.2], [25000, 35000, 0.25], [35000, 55000, 0.3], [55000, 80000, 0.35], [80000, 1e9, 0.45]]; }
  }
  E.shopping_cart = function (v) {
    var items = String(v[0] || "").split("\n").filter(Boolean), shipping = num(v[1], 10), tax = num(v[2], 0);
    var sub = 0, detail = [];
    items.forEach(function (line) {
      var m = line.match(/^(.+?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/);
      var name = line, qty = 1;
      if (m) { name = m[1]; qty = parseFloat(m[2]); }
      sub += qty; detail.push([name.trim() + " × " + qty, fmtI(qty) + T(" 件", " items", " قطعة")]);
    });
    var total = sub * 0 + shipping + (P_total(v));
    return big(fmtI(sub) + T(" 件商品", " items", " قطعة"),
      T("运费 " + money(shipping) + "，合计 " + money(total), "Ship " + money(shipping), "شحن " + money(shipping)))
      + rows(detail.concat([[T("运费", "Shipping", "الشحن"), money(shipping)],
      [T("税", "Tax", "الضريبة"), money(P_total(v) * tax / 100)],
      [T("实付合计", "Total payable", "الإجمالي"), money(shipping + P_total(v) * (1 + tax / 100))]]));
  };
  function P_total(v) { var t = parseFloat(v[3]); return isFinite(t) ? t : 0; }
  E.loan_compare = function (v) {
    var a1 = num(v[0], 4.9), t1 = num(v[1], 30), a2 = num(v[2], 3.2), t2 = num(v[3], 20), P0 = num(v[4], 1000000);
    function total(rate, yrs) { var n = yrs * 12, rr = rate / 100 / 12, m = pmt(P0, rr, n); return { m: m, total: m * n, int: m * n - P0 }; }
    var A = total(a1, t1), B = total(a2, t2);
    return big(money(A.int - B.int) + T(" 利息差", " interest difference", " فرق الفوائد"),
      T("方案 A " + fmt(a1, 2) + "%/" + t1 + T(" 年 vs B ", " vs ", " مقابل ") + fmt(a2, 2) + "%/" + t2 + T(" 年", "y", "سنة"), ""))
      + rows([[T("A 月供 / 总利息", "A payment / interest", "أ: القسط والفوائد"), money(A.m) + " / " + money(A.int)],
      [T("B 月供 / 总利息", "B payment / interest", "ب: القسط والفوائد"), money(B.m) + " / " + money(B.int)],
      [T("月供差", "Payment difference", "فرق القسط"), money(A.m - B.m)],
      [T("总支出差", "Total difference", "فرق الإجمالي"), money(A.total - B.total)]]);
  };
  E.salary_compare = function (v) {
    var a = num(v[0], 20000), b = num(v[1], 23000), c = num(v[2], 30), d = num(v[3], 20);
    var ta = a * 12 + a * c / 12, tb = b * 12 + b * d / 12;
    return big(money(tb - ta) + T(" 年包差", " package difference", " فرق الحزمة"),
      T("A " + money(a) + T(" +", " + ", " + ") + c + T(" 个月奖金", " months bonus", " شهر مكافأة"), ""))
      + rows([[T("A 年包", "A package", "حزمة أ"), money(ta)],
      [T("B 年包", "B package", "حزمة ب"), money(tb)],
      [T("A 有效时薪", "A hourly", "أجر أ"), money(ta / (12 * 21.75 * 8))],
      [T("B 有效时薪", "B hourly", "أجر ب"), money(tb / (12 * 21.75 * 8))]]);
  };
  E.invoice_tax = E.tax_vat;
  E.bmi_category = E.bmi;

  window.BDS_E = E;
})();
